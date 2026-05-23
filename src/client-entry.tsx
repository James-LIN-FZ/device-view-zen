import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const router = getRouter();
// Mount at document level so TanStack Router's shellComponent (<html>/<body>)
// renders correctly without the browser repositioning those special elements.
createRoot(document).render(<RouterProvider router={router} />);
