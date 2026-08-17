# Copilot-style React Chat UI

A responsive React + TypeScript chat interface inspired by the clean structure
of Copilot. The crossed-out Library, Agents, and suggestion-chip areas are not
included.

## Included

- New chat and searchable chat history
- Local chat persistence with `localStorage`
- One API request per submitted prompt
- Loading, error, empty, desktop, and mobile states
- Delete conversation action
- Enter to send and Shift+Enter for a new line

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Without an API URL, the app uses a short demo response so the complete UI can
be tested immediately.

## Connect your chat API

Set these values in `.env`:

```env
AIFORCE_URL=https://aiforce.hcltech.com/aes/usecases/execute
AIFORCE_TOKEN=your-bearer-token
VITE_AIFORCE_URL=/api/aiforce
VITE_AIFORCE_USECASE=your-usecase
```

During `npm run dev`, the browser sends the request to the same-origin
`/api/aiforce` path. Vite forwards it to `AIFORCE_URL` and adds the bearer
token. This avoids browser CORS errors and keeps the development token out of
the client bundle.

The app sends:

```json
{
  "usecase": "your-usecase",
  "input": "The latest user prompt",
  "messages": [
    {
      "role": "user",
      "content": "The latest user prompt"
    }
  ]
}
```

The bearer token is sent in the request header:

```text
Authorization: Bearer <AIFORCE_TOKEN>
```

Requests time out after 90 seconds.

Successful responses must contain:

```json
{
  "data": {
    "output": "Assistant response text"
  }
}
```

For failed HTTP responses, the app displays the API's `message` value when
available:

```json
{
  "message": "Error details"
}
```

If no error message is returned, the app displays the HTTP status code.

The included proxy runs only with the Vite development server. A production
deployment must implement a server-side `/api/aiforce` route that forwards the
same payload and bearer token. Do not put the production token in a `VITE_`
variable because those values are visible in the browser.
