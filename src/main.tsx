import { createRoot } from "react-dom/client";

import { App } from "./app";

const appNode = document.getElementById("app");
const root = createRoot(appNode!);

root.render(<App></App>);
