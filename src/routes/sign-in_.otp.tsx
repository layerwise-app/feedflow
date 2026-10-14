import { useState } from 'react';
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate
} from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '~/lib/auth-client';
import { AuthShell } from '~/components/auth-shell';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '~/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot
} from '~/components/ui/input-otp';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/sign-in_/otp')({
  head: () => ({ meta: seo({ title: 'Check your email · Feedflow' }) }),
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === 'string' ? search.email.trim() : ''
  }),
  beforeLoad: ({ search }) => {
    if (!search.email) throw redirect({ to: '/sign-in' });
  },
  component: EmailOtpPage
});

function EmailOtpPage() {
  const navigate = useNavigate();
  const { email } = Route.useSearch();
  const [otp, setOtp] = useState('');

  const verifyOtp = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signIn.emailOtp({ email, otp });
      if (error) throw new Error(error.message ?? 'Invalid code');
    },
    onSuccess: () => navigate({ to: '/dashboard' })
  });

  const resendOtp = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in'
      });
      if (error) throw new Error(error.message ?? 'Failed to resend code');
    }
  });

  return (
    <AuthShell>
      <Card className='w-full'>
        <CardHeader>
          <CardTitle className='font-serif text-2xl font-semibold tracking-[-0.015em]'>Check your email</CardTitle>
          <CardDescription>
            Enter the six-digit code we sent to {email}.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-6'>
          <form
            className='flex flex-col gap-4'
            onSubmit={(event) => {
              event.preventDefault();
              verifyOtp.mutate();
            }}
          >
            <InputOTP
              autoFocus
              autoComplete='one-time-code'
              containerClassName='w-full'
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                verifyOtp.reset();
              }}
            >
              <InputOTPGroup className='w-full'>
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} className='flex-1' />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {verifyOtp.error ? (
              <p className='text-sm text-destructive'>
                {verifyOtp.error.message}
              </p>
            ) : null}
            <Button
              type='submit'
              disabled={otp.length < 6 || verifyOtp.isPending}
            >
              {verifyOtp.isPending && <Spinner />}
              Sign in
            </Button>
          </form>
          <div className='flex flex-col items-center gap-2 text-sm'>
            <Button
              type='button'
              variant='link'
              className='h-auto p-0'
              disabled={resendOtp.isPending}
              onClick={() => resendOtp.mutate()}
            >
              {resendOtp.isPending && <Spinner />}
              {resendOtp.isSuccess ? 'Code sent' : 'Resend code'}
            </Button>
            {resendOtp.error ? (
              <p className='text-center text-sm text-destructive'>
                {resendOtp.error.message}
              </p>
            ) : null}
            <Link to='/sign-in' className='text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'>
              Use a different email
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
