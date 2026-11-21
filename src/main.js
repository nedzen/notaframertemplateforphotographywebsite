/* Entry point. Feature modules attach their own listeners; transitions owns
   the page state machine and publishes the hooks the others call. */

import "./router.js";
import "./index.js";
import "./sheets.js";
import "./grid.js";
import "./project/index.js";
import "./transitions.js";
import "./form.js";
import { startEntrance } from "./preloader.js";

startEntrance();
