#!/usr/bin/env python3
"""
Polls a dedicated Gmail inbox for recipe URLs forwarded from the user's phone.

For each unread email:
  - Extracts URLs from the subject line and body
  - Skips URLs already saved to the database
  - Calls the /api/parse endpoint to fetch and structure the recipe via Claude
  - Saves the recipe via /api/recipes
  - Labels the email recipe-processed or recipe-failed
  - Marks the email as read

Run on a schedule (e.g. every 15 minutes via cron).
"""

import email
import imaplib
import logging
import os
import re

import requests
from dotenv import find_dotenv, load_dotenv

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

IMAP_HOST = 'imap.gmail.com'
LABEL_PROCESSED = 'recipe-processed'
LABEL_FAILED = 'recipe-failed'
URL_PATTERN = re.compile(r'https?://[^\s<>"\')\]]+')


def extract_urls(msg):
    """Return a deduplicated list of URLs from an email's subject and body."""
    found = set()

    found.update(URL_PATTERN.findall(msg.get('Subject', '')))

    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() in ('text/plain', 'text/html'):
                try:
                    text = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    found.update(URL_PATTERN.findall(text))
                except Exception:
                    pass
    else:
        try:
            text = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
            found.update(URL_PATTERN.findall(text))
        except Exception:
            pass

    # Strip trailing punctuation that is likely part of the surrounding sentence
    return list({u.rstrip('.,;:!?') for u in found})


def url_already_exists(source_url, supabase_url, supabase_key):
    """Return True if a recipe with this source_url already exists in the database."""
    try:
        resp = requests.get(
            f'{supabase_url}/rest/v1/recipes',
            params={'source_url': f'eq.{source_url}', 'select': 'id'},
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
            },
            timeout=10,
        )
        if not resp.ok:
            log.warning('Duplicate check request failed: %s', resp.text)
            return False
        return len(resp.json()) > 0
    except Exception as exc:
        log.warning('Duplicate check error: %s', exc)
        return False


def parse_and_save(source_url, base_url):
    """
    Call the parse endpoint then save the recipe.
    Raises RuntimeError if either step fails.
    Returns the saved recipe dict on success.
    """
    parse_resp = requests.post(
        f'{base_url}/api/parse',
        json={'url': source_url},
        timeout=60,
    )
    if not parse_resp.ok:
        error = parse_resp.json().get('error', parse_resp.text) if parse_resp.content else parse_resp.text
        raise RuntimeError(f'Parse failed ({parse_resp.status_code}): {error}')

    recipe = parse_resp.json()
    recipe['capture_method'] = 'email'

    save_resp = requests.post(
        f'{base_url}/api/recipes',
        json=recipe,
        timeout=30,
    )
    if not save_resp.ok:
        error = save_resp.json().get('error', save_resp.text) if save_resp.content else save_resp.text
        raise RuntimeError(f'Save failed ({save_resp.status_code}): {error}')

    return save_resp.json()


def apply_label(mail, uid, label):
    """Add a Gmail label to a message. Silently ignores failures."""
    try:
        mail.uid('COPY', uid, label)
    except Exception as exc:
        log.warning('Could not apply label "%s": %s', label, exc)


def ensure_labels(mail):
    """Create the processing labels if they don't already exist."""
    for label in (LABEL_PROCESSED, LABEL_FAILED):
        mail.create(label)  # Returns NO if the label already exists — that's fine


def poll():
    load_dotenv(find_dotenv('.env.local'))

    gmail_address = os.environ['GMAIL_ADDRESS']
    gmail_password = os.environ['GMAIL_APP_PASSWORD']
    base_url = os.environ['RECIPE_BOX_URL'].rstrip('/')
    supabase_url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
    supabase_key = os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY']

    log.info('Connecting to Gmail...')
    mail = imaplib.IMAP4_SSL(IMAP_HOST)
    mail.login(gmail_address, gmail_password)
    mail.select('INBOX')
    ensure_labels(mail)

    _, data = mail.uid('SEARCH', None, 'UNSEEN')
    uids = data[0].split() if data[0] else []

    if not uids:
        log.info('No unread emails.')
        mail.logout()
        return

    log.info('Found %d unread email(s).', len(uids))

    for uid in uids:
        _, msg_data = mail.uid('FETCH', uid, '(RFC822)')
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        subject = msg.get('Subject', '(no subject)')
        log.info('Processing: %s', subject)

        urls = extract_urls(msg)

        if not urls:
            log.info('  No URLs found — skipping.')
            mail.uid('STORE', uid, '+FLAGS', '\\Seen')
            continue

        saved = False
        for url in urls:
            if url_already_exists(url, supabase_url, supabase_key):
                log.info('  Already in database: %s', url)
                saved = True
                break
            log.info('  Trying: %s', url)
            try:
                result = parse_and_save(url, base_url)
                log.info('  Saved: %s', result.get('title', url))
                saved = True
                break
            except RuntimeError as exc:
                log.warning('  Failed: %s', exc)

        mail.uid('STORE', uid, '+FLAGS', '\\Seen')
        apply_label(mail, uid, LABEL_PROCESSED if saved else LABEL_FAILED)
        log.info('  Labeled: %s', LABEL_PROCESSED if saved else LABEL_FAILED)

    mail.logout()
    log.info('Done.')


if __name__ == '__main__':
    poll()
