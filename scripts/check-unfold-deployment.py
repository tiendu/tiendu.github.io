#!/usr/bin/env python3
"""Read-only UNFOLD deployment checks; --smoke creates a temporary test room.

Pure Python standard library. Never prints room authentication tokens.
"""
import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_WORKER = 'https://unfold-multiplayer.tiendu107.workers.dev'
DEFAULT_SITE = 'https://tiendu.github.io'

def request(url, method='GET', body=None, headers=None, timeout=12):
    # Cloudflare workers.dev blocks Python-urllib's default User-Agent with
    # 403/1010 (Browser Integrity Check) before the Worker sees a request.
    # A descriptive application User-Agent is enough; do not impersonate Chrome.
    headers = {'User-Agent': 'UNFOLD-deployment-check/1.9.2', 'Accept': 'application/json', **(headers or {})}
    data = None if body is None else json.dumps(body).encode()
    if data is not None:
        headers = {'Content-Type': 'application/json', **headers}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read(100000).decode('utf-8', 'replace')
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read(100000).decode('utf-8', 'replace')


def show(name, good, info):
    print(f"[{'PASS' if good else 'FAIL'}] {name}: {info}")
    return bool(good)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--backend', default=DEFAULT_WORKER, help='UNFOLD backend origin (HTTPS)')
    p.add_argument('--site', default=DEFAULT_SITE, help='Site origin, default tiendu.github.io')
    p.add_argument('--skip-site', action='store_true', help='Skip published room-config.js check')
    p.add_argument('--smoke', action='store_true', help='Also create and join one disposable test room')
    args = p.parse_args()
    backend = args.backend.rstrip('/')
    site = args.site.rstrip('/')
    site_origin = urllib.parse.urlsplit(site)
    origin = f'{site_origin.scheme}://{site_origin.netloc}'
    passed = []
    print('UNFOLD deployment diagnostics (tokens are never printed)')
    print(f'  Site: {site}\n  Backend: {backend}\n')

    if not args.skip_site:
        try:
            status, _, body = request(site + '/games/unfold/room-config.js')
            has_url = backend in body
            config_blank = "UNFOLD_ROOM_API = ''" in body or 'UNFOLD_ROOM_API=""' in body
            passed.append(show('Published room config', status == 200 and has_url,
                f'HTTP {status}; expected backend URL {"present" if has_url else "not found"}' +
                ('; empty placeholder still present' if config_blank else '')))
            if not has_url:
                print('    Note: an Astro inline build-time injection may be used instead of room-config.js.\n'
                      '    Confirm window.UNFOLD_ROOM_API in the browser console on the published page.')
        except Exception as exc:
            passed.append(show('Published room config', False, str(exc)))

    try:
        status, _, body = request(backend + '/api/unfold/health')
        try:
            obj = json.loads(body)
        except ValueError:
            obj = {}
        passed.append(show('UNFOLD room health', status == 200 and obj.get('ok') is True,
            f'HTTP {status}; ' + (str(obj)[:190] if obj else body[:130])))
    except Exception as exc:
        passed.append(show('UNFOLD room health', False, str(exc)))

    try:
        status, headers, body = request(backend + '/api/unfold/create', method='OPTIONS', headers={
            'Origin': origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'
        })
        lowered = {k.lower(): v for k,v in headers.items()}
        allowed = lowered.get('access-control-allow-origin', '')
        methods = lowered.get('access-control-allow-methods', '')
        allowed_headers = lowered.get('access-control-allow-headers', '')
        good = status in (200, 204) and allowed in (origin,'*') and 'POST' in methods.upper() and 'content-type' in allowed_headers.lower()
        passed.append(show('Browser CORS preflight', good,
            f'HTTP {status}; allow-origin={allowed!r}; methods={methods!r}; headers={allowed_headers!r}'))
    except Exception as exc:
        passed.append(show('Browser CORS preflight', False, str(exc)))

    if args.smoke:
        try:
            def call(op, data):
                status, headers, body = request(backend + '/api/unfold/' + op, method='POST', body=data, headers={'Origin':origin})
                try: result = json.loads(body)
                except ValueError: raise RuntimeError(f'{op}: HTTP {status}, unexpected response {body[:150]!r}')
                if status != 200: raise RuntimeError(f'{op}: HTTP {status}, {result.get("error", "unknown error")}')
                return result
            a=call('create', {'name':'DeployCheckA','mode':'coop'})
            code=a['code']
            b=call('join', {'code':code,'name':'DeployCheckB'})
            started=call('start', {'code':code,'token':a['token']})
            sa=call('state', {'code':code,'token':a['token']})
            sb=call('state', {'code':code,'token':b['token']})
            good=all([
                len(code)==6, len(sa['seats'])==2, len(sb['seats'])==2,
                started.get('game') is not None, sa.get('revision')==sb.get('revision'),
                sa.get('game',{}).get('mode')=='coop',
            ])
            passed.append(show('Create / join / start / state',good,
                'both clients see a started co-op game' if good else 'inconsistent game or seats'))
            # Intentionally no move: avoid burning live turn time or modifying an ongoing game.
        except Exception as exc:
            passed.append(show('Create / join / start / state', False, str(exc)))

    print(f'\nSummary: {sum(passed)}/{len(passed)} checks passed')
    print('Note: health and CORS are read-only; --smoke creates a disposable test room.')
    print('A workers.dev 403/1010 can mean the HTTP client User-Agent was blocked, not the Worker.')
    return 0 if all(passed) else 1

if __name__=='__main__':
    sys.exit(main())
