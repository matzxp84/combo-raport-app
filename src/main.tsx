import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LogProvider } from "@/contexts/LogContext"
import { AuthProvider } from "@/contexts/AuthContext"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <LogProvider>
            <App />
          </LogProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
