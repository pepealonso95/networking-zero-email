import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateEmail } from '@/components/create/create-email';
import { authProxy } from '@/lib/auth-proxy';
import { useLoaderData } from 'react-router';
import { useNavigate } from 'react-router';
import { useQueryState } from 'nuqs';
import type { Route } from './+types/page';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await authProxy.api.getSession({ headers: request.headers });
  if (!session) return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/login`);
  const url = new URL(request.url);
  if (url.searchParams.get('to')?.startsWith('mailto:')) {
    return Response.redirect(
      `${import.meta.env.VITE_PUBLIC_APP_URL}/mail/compose/handle-mailto?mailto=${encodeURIComponent(url.searchParams.get('to') ?? '')}`,
    );
  }

  return Object.fromEntries(url.searchParams.entries()) as {
    to?: string;
    subject?: string;
    body?: string;
    draftId?: string;
    cc?: string;
    bcc?: string;
  };
}

export default function ComposePage() {
  const params = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Navigate to mail route when dialog is closed
      navigate('/mail');
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogDescription></DialogDescription>
      <DialogTrigger></DialogTrigger>
      <DialogContent className="h-screen w-screen max-w-none border-none bg-transparent p-0 shadow-none">
        <CreateEmail
          initialTo={params.to || ''}
          initialSubject={params.subject || ''}
          initialBody={params.body || ''}
          initialCc={params.cc || ''}
          initialBcc={params.bcc || ''}
          draftId={params.draftId || null}
        />
      </DialogContent>
    </Dialog>
  );
}
