import { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAppStore((s) => s.login);
  const currentUser = useAppStore((s) => s.currentUser);

  // Redirect based on role when already logged in
  useEffect(() => {
    if (currentUser) {
      redirectBasedOnRole(currentUser);
    }
  }, [currentUser]);

  const redirectBasedOnRole = (user: any) => {
    if (user.role === "admin") {
      window.location.href = "/admin/dashboard";
    } else if (user.role === "instructor") {
      window.location.href = "/instructor/dashboard";
    } else {
      window.location.href = "/";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      const success = await login(username, password);
      
      if (success && currentUser) {
        redirectBasedOnRole(currentUser);
      } else {
        setError("Invalid credentials. Try: admin, sarah, michael, priya, david");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-xl kpi-gradient flex items-center justify-center mb-2">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Instructor Hub</CardTitle>
          <CardDescription>Sign in to manage classes & track performance</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="Enter your username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Enter your password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p><strong>Admin Username:</strong> admin</p>
              <p><strong>Instructor Usernames:</strong> sarah, michael, priya, david</p>
              <p><strong>Demo Passwords:</strong> admin123, sarah123, michael123, priya123, david123</p>
              <p className="text-primary text-xs mt-2">Use username (not email) to login</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;