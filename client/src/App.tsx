import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const localizedBridgePaths = [
  "/en/file-bridge",
  "/tr/dosya-koprusu",
  "/de/dateibruecke",
  "/fr/pont-de-fichiers",
  "/es/puente-de-archivos",
  "/it/ponte-file",
  "/nl/bestandsbrug",
  "/sv/filbrygga",
  "/da/filbro",
  "/no/filbro",
  "/fi/tiedostosilta",
  "/zh/wenjian-qiaojie",
];

function Router() {
  // The main-site keeps the localized path while rewriting to this app.
  // Treat every published File Bridge slug as the Bridge home route.
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/bridge"} component={Home} />
      <Route path={"/bridge/"} component={Home} />
      {localizedBridgePaths.map((path) => (
        <Route key={path} path={path} component={Home} />
      ))}
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
