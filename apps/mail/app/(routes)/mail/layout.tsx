import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { OnboardingWrapper } from '@/components/onboarding';
import { NotificationProvider } from '@/components/party';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Outlet, useLoaderData } from 'react-router';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  return {
    headers: Object.fromEntries(request.headers.entries()),
  };
}

export default function MailLayout() {
  const { headers } = useLoaderData<typeof loader>();
  return (
    <HotkeyProviderWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
        <OnboardingWrapper />
        <NotificationProvider headers={headers} />
      </SidebarProvider>
    </HotkeyProviderWrapper>
  );
}
