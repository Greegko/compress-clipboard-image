import { Route, Router } from "@solidjs/router";

import { EditorPage } from "./pages/editor";
import { QuickPage } from "./pages/quick";

export const App = () => (
  <Router>
    <Route path="/" component={EditorPage} />
    <Route path="/quick" component={QuickPage} />
  </Router>
);
