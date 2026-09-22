# iframe-signing-harness

Статический стенд для встраивания и тестирования **партнёрской** iframe-страницы подписания TrustMe / TrustContract.

## URL подписания

```
{base}/contract/uploader/{shortUrl}
```

Примеры base:

| Env | Base |
|---|---|
| demo | `https://demo.tct.kz` |
| prod KZ | `https://trustme.kz` |
| OneSign | `https://signcontract.kz` |

Важно: использовать именно `/uploader/`, не `/upload/` — партнёрский `postMessage` шлётся только на route `Uploads`.

## Как пользоваться

1. Открой Pages URL (после деплоя) или локально: `npx serve public`
2. Выбери Base URL и вставь `shortUrl` документа/party (из SMS / кабинета / Public API)
3. Нажми **Load**
4. Смотри лог справа: события `ready` → `status` → `signed` / `error` / `revoked`

Поля Base/Short сохраняются в `localStorage`.

## Протокол postMessage

Iframe → parent:

```js
{
  source: 'trustcontract',
  version: 1,
  type: 'ready' | 'status' | 'signed' | 'error' | 'revoked',
  payload: {
    shortUrl,
    contractId,
    contractStatus,
    signStatus,
    partyId,
    errorCode, // optional
    // ...
  },
  timestamp: 1710000000000
}
```

Харнес принимает сообщения только если:

- `event.origin` совпадает с выбранным Base URL
- `data.source === 'trustcontract'`

## GitLab

- Проект: https://gitlab.trustme.kz/trustme/frontend/iframe-signing-harness
- Локально: `cd public && npx --yes serve .` (или `python3 -m http.server 8080` в `public/`)

### GitLab Pages

Job `pages` в [`.gitlab-ci.yml`](.gitlab-ci.yml) (runner tag `trustdeploy`) публикует `public/` с `main`.

После зелёного pipeline URL смотри в **Deploy → Pages** / **Settings → Pages**.

Если раздел Pages пустой или URL не открывается — на инстансе `gitlab.trustme.kz` может быть не настроен Pages domain (нужна infra). До этого стенд можно гонять локально.

## frame-ancestors

Если iframe пустой / blocked браузером — родительский origin (Pages или `http://localhost:…`) должен быть разрешён в nginx CSP `frame-ancestors` на стороне TrustMe. Это не чинится в этом репозитории.
