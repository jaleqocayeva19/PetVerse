# AI Vet Advisor

Floating chat widget that sends pet symptoms to the Gemini API and returns concise veterinary guidance: emergency steps, urgency, and which specialist to see.

## Run locally

Open `index.html` in a browser, or from this folder:

```bash
npx --yes serve .
```

## API key

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Paste it into the **Gemini API key** field in the widget (stored in this browser’s `localStorage` only).

The widget calls `gemini-3.6-flash` (falling back to `gemini-1.5-flash`) with `fetch` and streams the reply into the chat.

This is educational guidance only, not a substitute for a licensed veterinarian.
