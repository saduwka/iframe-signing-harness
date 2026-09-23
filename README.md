# iframe-signing-harness

Статический стенд для встраивания и тестирования **партнёрской** iframe-страницы подписания TrustMe / TrustContract.

## Live

- **GitHub Pages:** https://saduwka.github.io/iframe-signing-harness/
- **Репозиторий:** https://github.com/saduwka/iframe-signing-harness

Локально: `npx --yes serve public` (или `python3 -m http.server 8080` в `public/`).

## URL подписания

```
{base}/contract/uploader/{shortUrl}
```

Примеры base:

| Env | Base |
|---|---|
| prod KZ | `https://trustme.kz` |

Важно: использовать именно `/uploader/`, не `/upload/` — партнёрский `postMessage` шлётся только на route `Uploads`.

## Как пользоваться

1. Открой Pages URL (или локальный сервер)
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

## Деплой

GitHub Actions [`.github/workflows/pages.yml`](.github/workflows/pages.yml) публикует папку `public/` на GitHub Pages при push в `main`.

Зеркало на корпоративном GitLab (без рабочего Pages domain): https://gitlab.trustme.kz/trustme/frontend/iframe-signing-harness

## ЭЦП / NCALayer в iframe

Подписание через ЭЦП открывает WebSocket на `wss://127.0.0.1:13579` (локальный NCALayer).
В **cross-origin** iframe Chrome блокирует loopback, пока родитель не делегирует permission:

```html
<iframe
  src="https://trustme.kz/contract/uploader/{shortUrl}"
  allow="loopback-network"
  style="width:100%;height:90vh;border:0"
></iframe>
```

Без `allow="loopback-network"` в консоли будет `WebSocket connection to 'wss://127.0.0.1:13579/' failed`, а в UI — «Не удалось открыть NClayer».
Не ставьте лишний `sandbox` на iframe партнёрского embed — он мешает реальному сценарию.

## frame-ancestors

Если iframe пустой / blocked браузером — родительский origin (`https://saduwka.github.io` или `http://localhost:…`) должен быть разрешён в nginx CSP `frame-ancestors` на стороне TrustMe. Это не чинится в этом репозитории.
