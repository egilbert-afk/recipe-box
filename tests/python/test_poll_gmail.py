import sys
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../scripts'))
from poll_gmail import extract_urls, url_already_exists, parse_and_save


# ── helpers ──────────────────────────────────────────────────────────────────

def plain_email(subject='', body=''):
    msg = MIMEText(body, 'plain')
    msg['Subject'] = subject
    return msg


def multipart_email(subject='', text='', html=''):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    if text:
        msg.attach(MIMEText(text, 'plain'))
    if html:
        msg.attach(MIMEText(html, 'html'))
    return msg


SUPABASE_URL = 'https://example.supabase.co'
SUPABASE_KEY = 'test-key'
BASE_URL = 'https://myapp.vercel.app'

PARSED_RECIPE = {
    'title': 'Pasta',
    'cuisine_id': 'italian',
    'meal_type_id': 'entree',
    'servings': 2,
    'source_url': 'https://example.com/pasta',
    'ingredients': [{'name': 'pasta', 'amount': 200, 'unit': 'g', 'order_index': 0}],
    'steps': [{'instruction': 'Boil water.', 'order_index': 0}],
}


# ── extract_urls ─────────────────────────────────────────────────────────────

class TestExtractUrls:
    def test_extracts_url_from_plain_body(self):
        msg = plain_email(body='Try this: https://cooking.nytimes.com/recipes/1234')
        assert 'https://cooking.nytimes.com/recipes/1234' in extract_urls(msg)

    def test_returns_empty_when_no_urls(self):
        msg = plain_email(body='Just text, no links.')
        assert extract_urls(msg) == []

    def test_extracts_url_from_subject_line(self):
        msg = plain_email(subject='https://seriouseats.com/pasta-recipe', body='')
        assert 'https://seriouseats.com/pasta-recipe' in extract_urls(msg)

    def test_extracts_url_from_html_part(self):
        html = '<p>Try <a href="https://example.com/recipe">this</a></p>'
        msg = multipart_email(html=html)
        assert any('example.com/recipe' in u for u in extract_urls(msg))

    def test_deduplicates_the_same_url(self):
        body = 'https://example.com/recipe https://example.com/recipe'
        msg = plain_email(body=body)
        matches = [u for u in extract_urls(msg) if 'example.com/recipe' in u]
        assert len(matches) == 1

    def test_handles_empty_body_without_raising(self):
        msg = plain_email(subject='hey', body='')
        assert extract_urls(msg) == []

    def test_handles_malformed_multipart_without_raising(self):
        msg = multipart_email(subject='test')  # no parts attached
        result = extract_urls(msg)
        assert isinstance(result, list)

    def test_strips_trailing_punctuation_from_url(self):
        msg = plain_email(body='Check this out: https://cooking.nytimes.com/recipes/1234.')
        urls = extract_urls(msg)
        assert 'https://cooking.nytimes.com/recipes/1234' in urls
        assert 'https://cooking.nytimes.com/recipes/1234.' not in urls


# ── url_already_exists ────────────────────────────────────────────────────────

class TestUrlAlreadyExists:
    @patch('poll_gmail.requests.get')
    def test_returns_true_when_recipe_exists(self, mock_get):
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = [{'id': 'abc-123'}]
        assert url_already_exists('https://example.com/recipe', SUPABASE_URL, SUPABASE_KEY) is True

    @patch('poll_gmail.requests.get')
    def test_returns_false_when_no_match(self, mock_get):
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = []
        assert url_already_exists('https://example.com/new', SUPABASE_URL, SUPABASE_KEY) is False

    @patch('poll_gmail.requests.get')
    def test_returns_false_when_request_fails(self, mock_get):
        mock_get.side_effect = Exception('Network error')
        assert url_already_exists('https://example.com', SUPABASE_URL, SUPABASE_KEY) is False

    @patch('poll_gmail.requests.get')
    def test_returns_false_when_response_not_ok(self, mock_get):
        mock_get.return_value.ok = False
        mock_get.return_value.text = 'Unauthorized'
        assert url_already_exists('https://example.com', SUPABASE_URL, SUPABASE_KEY) is False


# ── parse_and_save ────────────────────────────────────────────────────────────

class TestParseAndSave:
    @patch('poll_gmail.requests.post')
    def test_raises_on_parse_failure(self, mock_post):
        mock_post.return_value.ok = False
        mock_post.return_value.status_code = 422
        mock_post.return_value.content = b'error'
        mock_post.return_value.json.return_value = {'error': 'Failed to fetch page'}
        with pytest.raises(RuntimeError, match='Parse failed'):
            parse_and_save('https://example.com/recipe', BASE_URL)

    @patch('poll_gmail.requests.post')
    def test_raises_on_save_failure(self, mock_post):
        parse_ok = MagicMock()
        parse_ok.ok = True
        parse_ok.json.return_value = PARSED_RECIPE.copy()

        save_fail = MagicMock()
        save_fail.ok = False
        save_fail.status_code = 400
        save_fail.content = b'error'
        save_fail.json.return_value = {'error': 'At least one ingredient is required'}

        mock_post.side_effect = [parse_ok, save_fail]
        with pytest.raises(RuntimeError, match='Save failed'):
            parse_and_save('https://example.com/recipe', BASE_URL)

    @patch('poll_gmail.requests.post')
    def test_sets_capture_method_to_email(self, mock_post):
        parse_ok = MagicMock()
        parse_ok.ok = True
        parse_ok.json.return_value = PARSED_RECIPE.copy()

        save_ok = MagicMock()
        save_ok.ok = True
        save_ok.json.return_value = {'id': 'new-id', 'title': 'Pasta'}

        mock_post.side_effect = [parse_ok, save_ok]
        parse_and_save('https://example.com/recipe', BASE_URL)

        save_call_body = mock_post.call_args_list[1][1]['json']
        assert save_call_body['capture_method'] == 'email'

    @patch('poll_gmail.requests.post')
    def test_returns_saved_recipe_on_success(self, mock_post):
        parse_ok = MagicMock()
        parse_ok.ok = True
        parse_ok.json.return_value = PARSED_RECIPE.copy()

        save_ok = MagicMock()
        save_ok.ok = True
        save_ok.json.return_value = {'id': 'new-id', 'title': 'Pasta'}

        mock_post.side_effect = [parse_ok, save_ok]
        result = parse_and_save('https://example.com/recipe', BASE_URL)
        assert result['id'] == 'new-id'
