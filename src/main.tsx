import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LogProvider } from "@/contexts/LogContext"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <LogProvider>
          <App />
        </LogProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
