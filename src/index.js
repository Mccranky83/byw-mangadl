import createSidebar from "./components/sidebar.js";
import createMenu from "./components/menu.js";
import manualSelect from "./components/cursor.js";
import initPB from "./components/pb.js";

("use strict");

$("<script>", {
  type: "text/javascript",
  src: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
}).appendTo(document.head);

createSidebar();
createMenu();
manualSelect();
initPB();
