// Lance le faux serveur Google comme processus à part (utilisé par la configuration Playwright).
import { startFakeGoogle } from "./fake-google.ts";

const port = Number(process.env.FAKE_GOOGLE_PORT ?? 3199);
await startFakeGoogle(port);
console.log(`faux Google sur http://127.0.0.1:${port}`);
