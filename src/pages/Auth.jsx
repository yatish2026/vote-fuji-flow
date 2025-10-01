import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Vote } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // Login state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginIdType, setLoginIdType] = useState('voter'); // 'voter', 'pan', or 'aadhaar'

  // Signup state
  const [signupData, setSignupData] = useState({
    password: '',
    confirmPassword: '',
    fullName: '',
    voterId: '',
    panCard: '',
    aadhaarCard: ''
  });

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if profile is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          navigate('/vote');
        }
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call edge function to get email from government ID
      const { data: emailData, error: emailError } = await supabase.functions.invoke('get-user-email', {
        body: { govtId: loginId, idType: loginIdType }
      });

      if (emailError || !emailData.email) {
        throw new Error('Invalid credentials. Please check your ID and try again.');
      }

      // Now login with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailData.email,
        password: loginPassword
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'You have been logged in successfully.',
      });

      navigate('/vote');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Login failed. Please check your credentials.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Validation
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (!signupData.voterId && !signupData.panCard && !signupData.aadhaarCard) {
      toast({
        title: 'Error',
        description: 'Please provide at least one government ID (Voter ID, PAN Card, or Aadhaar Card)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Generate a unique email from the government ID
      const primaryId = signupData.voterId || signupData.panCard || signupData.aadhaarCard;
      const generatedEmail = `${primaryId.replace(/\s/g, '')}@votesystem.internal`;

      // Sign up the user with generated email
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: generatedEmail,
        password: signupData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/vote`
        }
      });

      if (signUpError) throw signUpError;

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: signupData.fullName,
          voter_id: signupData.voterId || null,
          pan_card: signupData.panCard || null,
          aadhaar_card: signupData.aadhaarCard || null,
          is_verified: false
        });

      if (profileError) throw profileError;

      toast({
        title: 'Success!',
        description: 'Account created successfully. You can now log in with your government ID.',
      });

      setActiveTab('login');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Vote className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Blockchain Voting System</CardTitle>
          <CardDescription className="text-center">
            Secure, transparent, and decentralized voting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-id-type">ID Type</Label>
                  <select
                    id="login-id-type"
                    value={loginIdType}
                    onChange={(e) => setLoginIdType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="voter">Voter ID</option>
                    <option value="pan">PAN Card</option>
                    <option value="aadhaar">Aadhaar Card</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-id">
                    {loginIdType === 'voter' ? 'Voter ID' : loginIdType === 'pan' ? 'PAN Card' : 'Aadhaar Card'}
                  </Label>
                  <Input
                    id="login-id"
                    type="text"
                    placeholder={`Enter your ${loginIdType === 'voter' ? 'Voter ID' : loginIdType === 'pan' ? 'PAN Card' : 'Aadhaar Card'}`}
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signupData.fullName}
                    onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Government ID (At least one required)
                  </Label>
                  <Input
                    placeholder="Voter ID"
                    value={signupData.voterId}
                    onChange={(e) => setSignupData({ ...signupData, voterId: e.target.value })}
                  />
                  <Input
                    placeholder="PAN Card"
                    value={signupData.panCard}
                    onChange={(e) => setSignupData({ ...signupData, panCard: e.target.value })}
                  />
                  <Input
                    placeholder="Aadhaar Card"
                    value={signupData.aadhaarCard}
                    onChange={(e) => setSignupData({ ...signupData, aadhaarCard: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign Up
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;