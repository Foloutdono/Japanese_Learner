"""
Scrapes grammar points from jlptsensei.com for all JLPT levels.
Run once locally: python scripts/scrape_grammar.py
Outputs: backend/grammar_data.py
"""

import requests
import time
import json
from bs4 import BeautifulSoup

LEVELS  = ['n5', 'n4', 'n3', 'n2', 'n1']
BASE    = 'https://jlptsensei.com'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}


def scrape_grammar_list(level: str) -> list[dict]:
    print(1)
    url  = f"{BASE}/jlpt-{level}-grammar-list/"
    resp = requests.get(url, headers=HEADERS, timeout=10)
    soup = BeautifulSoup(resp.text, 'html.parser')

    points = []
    for row in soup.select('table.jl-table tbody tr'):
        cols = row.select('td')
        if len(cols) < 2:
            continue
        link = cols[1].select_one('a')
        if not link:
            continue

        # Try to get Japanese text specifically
        jp_el  = link.select_one('.jp') or link.select_one('[lang="ja"]')
        grammar = jp_el.get_text(strip=True) if jp_el else link.get_text(strip=True)

        detail_url = link['href']
        if detail_url.startswith('/'):
            detail_url = BASE + detail_url

        meaning = cols[2].get_text(strip=True) if len(cols) > 2 else ''
        points.append({
            'grammar':    grammar,
            'meaning':    meaning,
            'detail_url': detail_url,
        })
    return points


def scrape_grammar_detail(url: str) -> dict:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')

        # Japanese grammar form from title
        jp_title = soup.select_one('h1 .jp')
        grammar_jp = jp_title.get_text(strip=True) if jp_title else ''

        # Meaning
        meaning_el = soup.select_one('.eng-definition')
        meaning    = meaning_el.get_text(strip=True) if meaning_el else ''

        # Structure
        structure = ''
        usage_el  = soup.select_one('.usage')
        if usage_el:
            rows = []
            for tr in usage_el.select('tr'):
                cells = [td.get_text(' ', strip=True) for td in tr.select('td')]
                if cells:
                    rows.append(' → '.join(cells))
            structure = ' | '.join(rows)

        # Explanation — only first 2 paragraphs from grammar-notes
        # skip paragraphs that contain download/patreon links
        explanation = ''
        notes_el    = soup.select_one('.grammar-notes')
        if notes_el:
            clean = []
            for p in notes_el.select('p'):
                text = p.get_text(' ', strip=True)
                # skip ad/promo content
                if any(skip in text for skip in ['Download', 'Patreon', 'flashcard', 'E-book', 'ebook']):
                    continue
                if text:
                    clean.append(text)
                if len(clean) >= 2:
                    break
            explanation = ' '.join(clean)

        # Example sentences
        examples = []
        for ex in soup.select('.example-cont')[:5]:
            jp_el  = ex.select_one('.example-main .jp')
            rom_el = ex.select_one('.alert-info')
            en_el  = ex.select_one('.alert-primary')
            if jp_el and en_el:
                examples.append({
                    'jp':     jp_el.get_text(strip=True),
                    'romaji': rom_el.get_text(strip=True) if rom_el else '',
                    'en':     en_el.get_text(strip=True),
                })

        return {
            'grammar_jp':  grammar_jp,  # Japanese form from detail page
            'meaning':     meaning,
            'structure':   structure,
            'explanation': explanation,
            'examples':    examples,
        }
    except Exception as e:
        print(f"  Error: {e}")
        return {'grammar_jp': '', 'meaning': '', 'structure': '', 'explanation': '', 'examples': []}


def main():
    all_grammar = {}

    for level in LEVELS:
        print(f"\nScraping {level.upper()}...")
        points = scrape_grammar_list(level)
        print(f"  Found {len(points)} grammar points")

        enriched = []
        for i, point in enumerate(points):
            print(f"  [{i+1}/{len(points)}] {point['grammar']}")
            detail = scrape_grammar_detail(point['detail_url'])
            enriched.append({
                # prefer Japanese form from detail page
                'grammar':     detail['grammar_jp'] or point['grammar'],
                'meaning':     detail['meaning'] or point['meaning'],
                'structure':   detail['structure'],
                'explanation': detail['explanation'],
                'examples':    detail['examples'],
                'detail_url':  point['detail_url'],
            })
            time.sleep(1)

        all_grammar[level.upper()] = enriched
        print(f"  Done {level.upper()}: {len(enriched)} points")

    with open('grammar_data.py', 'w', encoding='utf-8') as f:
        f.write('"""\nGrammar data scraped from jlptsensei.com\n"""\n\n')
        f.write('GRAMMAR_BY_LEVEL = ')
        f.write(json.dumps(all_grammar, ensure_ascii=False, indent=2))
        f.write('\n\n')
        f.write('def grammar_to_id(entry: dict, level: str) -> str:\n')
        f.write("    return f\"grammar_{level}_{entry['grammar']}\"\n")

    print("\nDone! grammar_data.py written.")

if __name__ == "__main__":
    main()