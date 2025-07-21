import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import {
  BookDashedIcon,
  GitBranchPlus,
  MessageSquareIcon,
  RefreshCcwDotIcon,
  SendIcon,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { AiChatPrompt, StyledEmailAssistantSystemPrompt } from '@/lib/prompts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { Button } from '@/components/ui/button';
import { Paper } from '../icons/icons';
import { Textarea } from './textarea';
import { Link } from 'react-router';

export function PromptsDialog() {
  const trpc = useTRPC();
  const { data: prompts } = useQuery(trpc.brain.getPrompts.queryOptions());
  return (
    <TooltipProvider delayDuration={0}>
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" className="md:h-fit md:px-2 [&>svg]:size-3">
                <Paper className="dark:fill-current fill-current h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Prompts</TooltipContent>
        </Tooltip>
        <DialogContent className="max-w-screen-lg" showOverlay={true}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ZeroAI System Prompts{' '}
              <Link
                to={'https://github.com/Mail-0/Zero.git'}
                target="_blank"
                className="flex items-center gap-1 text-xs underline"
              >
                <span>Contribute</span>
                <GitBranchPlus className="h-4 w-4" />
              </Link>
            </DialogTitle>
            <DialogDescription>
              We believe in Open Source, so we're open sourcing our AI system prompts. Soon you will
              be able to customize them to your liking.
            </DialogDescription>
          </DialogHeader>
          <Tabs className="mt-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="chat">
                <MessageSquareIcon className="mr-2 h-4 w-4" /> Chat
              </TabsTrigger>
              <TabsTrigger value="compose">
                <SendIcon className="mr-2 h-4 w-4" /> Compose
              </TabsTrigger>
              <TabsTrigger value="summarizeThread">
                <BookDashedIcon className="mr-2 h-4 w-4" /> Summarize Thread
              </TabsTrigger>
              <TabsTrigger value="reSummarizeThread">
                <RefreshCcwDotIcon className="mr-2 h-4 w-4" /> Re-Summarize Thread
              </TabsTrigger>
              <TabsTrigger value="summarizeMessage">
                <BookDashedIcon className="mr-2 h-4 w-4" /> Summarize Message
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chat">
              <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                This system prompt is used in the chat sidebar agent. The agent has multiple tools
                available.
              </span>
              <Textarea className="min-h-60" readOnly value={AiChatPrompt('', '', '')} />
            </TabsContent>
            <TabsContent value="compose">
              <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                This system prompt is used to compose emails that sound like you.
              </span>
              <Textarea
                className="min-h-60"
                readOnly
                value={StyledEmailAssistantSystemPrompt().trim()}
              />
            </TabsContent>
            {prompts ? (
              <TabsContent value="summarizeThread">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used to summarize threads. It takes the entire thread and
                  key information and summarizes them.
                </span>
                <Textarea className="min-h-60" readOnly value={prompts?.SummarizeThread} />
              </TabsContent>
            ) : null}
            {prompts ? (
              <TabsContent value="reSummarizeThread">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used to re-summarize threads. It's used when the thread
                  messages change and a new context is needed.
                </span>
                <Textarea className="min-h-60" readOnly value={prompts?.ReSummarizeThread} />
              </TabsContent>
            ) : null}
            {prompts ? (
              <TabsContent value="summarizeMessage">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used to summarize messages. It takes a single message and
                  summarizes it.
                </span>
                <Textarea className="min-h-60" readOnly value={prompts?.SummarizeMessage} />
              </TabsContent>
            ) : null}
          </Tabs>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
