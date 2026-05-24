import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import ImageGallery from "./pages/ImageGallery";
import IssueTracker from "./pages/IssueTracker";
import IssueDetail from "./pages/IssueDetail";
import ContactDetail from "./pages/ContactDetail";
import Memory from "./pages/Memory";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import ChatInbox from "./pages/ChatInbox";
import Users from "./pages/Users";
import ProjectList from "./pages/projects/ProjectList";
import ProjectCreate from "./pages/projects/ProjectCreate";
import ProjectDetail from "./pages/projects/ProjectDetail";
import ProjectEdit from "./pages/projects/ProjectEdit";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/conversations" component={Conversations} />
      <Route path="/conversations/:id" component={ConversationDetail} />
      <Route path="/gallery" component={ImageGallery} />
      <Route path="/issues" component={IssueTracker} />
      <Route path="/issues/:id" component={IssueDetail} />
      <Route path="/contacts/:id" component={ContactDetail} />
      <Route path="/memory" component={Memory} />
      <Route path="/reports" component={Reports} />
      <Route path="/users" component={Users} />
      <Route path="/settings" component={Settings} />
      <Route path="/inbox" component={ChatInbox} />
      <Route path="/projects" component={ProjectList} />
      <Route path="/projects/new" component={ProjectCreate} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/projects/:id/edit" component={ProjectEdit} />
      <Route path="/profile" component={Profile} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
