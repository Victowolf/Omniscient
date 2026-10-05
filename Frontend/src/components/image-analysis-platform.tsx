import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  CalendarDays,
  Clock3,
  Images,
  LogOut,
  Menu,
  MessageSquareText,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AnalysisImage {
  id: string;
  name: string;
  date: string;
  src: string;
  file?: File;
  local?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  imageIds?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  images: AnalysisImage[];
}

export type WorkspaceTab = "chatbot" | "time-series";

export interface ImageAnalysisPlatformProps {
  onSendMessage?: (payload: {
    message: string;
    images: AnalysisImage[];
    history: Message[];
    sessionId: string;
  }) => Promise<string>;
  onSendTimeSeriesQuery?: (payload: {
    query: string;
    images: AnalysisImage[];
    history: Message[];
  }) => Promise<string>;
  userDisplayName?: string;
  userRole?: string;
}

const API_BASE_URL = "https://backend-omniscient.onrender.com";
const OMNISCIENT_LOGO_URL = "/assets/omniscient-logo.webp";
const LOGIN_BACKGROUND_VIDEO_URL = "/assets/login-background.mp4";

const apiEndpoint = (path: string) => `${API_BASE_URL}${path}`;

// Time-series requests only ever operate on up to 4 dated images.
const MAX_TIME_SERIES_IMAGES = 4;

function toHistoryPairs(messages: Message[]): { user: string; assistant: string }[] {
  const pairs: { user: string; assistant: string }[] = [];
  let i = 0;
  while (i < messages.length) {
    const current = messages[i];
    if (!current) {
      i += 1;
      continue;
    }
    const next = messages[i + 1];
    if (current.role === "user" && next && next.role === "assistant") {
      pairs.push({ user: current.content, assistant: next.content });
      i += 2;
    } else {
      i += 1;
    }
  }
  return pairs;
}

async function sendChatMessageToBackend({
  message,
  images,
  history,
}: {
  message: string;
  images: AnalysisImage[];
  history: Message[];
}): Promise<string> {
  const formData = new FormData();
  formData.append("prompt", message);

  const historyPairs = toHistoryPairs(history);
  if (historyPairs.length) {
    formData.append("history", JSON.stringify(historyPairs));
  }

  images.forEach((image) => {
    if (image.file) {
      formData.append("images", image.file, image.name);
    }
  });

  const response = await fetch(apiEndpoint("/api/chat/vqa"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? `Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.response as string;
}

/**
 * Sends a time-series query to the backend.
 *
 * The prompt the user typed gets an explicit "perform a time-series analysis"
 * instruction appended to it, and up to MAX_TIME_SERIES_IMAGES dated images
 * are attached as an `images` array field (one file part per image, same as
 * the chat endpoint) so the backend can reason across the whole set at once.
 *
 * Adjust the endpoint path below if your backend exposes time-series
 * comparison under a different route than `/api/chat/timeseries`.
 */
async function sendTimeSeriesQueryToBackend({
  query,
  images,
  history,
}: {
  query: string;
  images: AnalysisImage[];
  history: Message[];
}): Promise<string> {
  const formData = new FormData();

  const prompt = [
    query,
    "Perform a time-series analysis across the provided images: identify what changed between the captured dates, note any anomalies or trends, and reference dates where relevant.",
  ]
    .filter(Boolean)
    .join("\n\n");
  formData.append("prompt", prompt);

  const historyPairs = toHistoryPairs(history);
  if (historyPairs.length) {
    formData.append("history", JSON.stringify(historyPairs));
  }

  // images: array<string> of up to 4 file parts, oldest-to-newest (images
  // arrive pre-sorted by capture date from the caller).
  images.slice(0, MAX_TIME_SERIES_IMAGES).forEach((image) => {
    if (image.file) {
      formData.append("images", image.file, image.name);
    }
  });

  const response = await fetch(apiEndpoint("/api/chat/timeseries"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? `Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.response as string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const parsed = new Date(dateString.includes("T") ? dateString : `${dateString}T12:00:00`);
  if (isNaN(parsed.getTime())) return dateString;
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(
    parsed,
  );
};

const currentTime = () =>
  new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getChatDateGroup = (timestamp: number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && now.getDate() === date.getDate()) return "Today";
  if (diffDays <= 1) return "Yesterday";
  if (diffDays < 7) return "Previous 7 days";
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
};

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" size="icon" variant="ghost" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Sidebar({
  chats,
  activeId,
  query,
  userDisplayName,
  userRole,
  onQuery,
  onSelect,
  onNew,
  onLogout,
  onClose,
}: {
  chats: ChatSession[];
  activeId: string;
  query: string;
  userDisplayName: string;
  userRole: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  const groupedChats = useMemo(() => {
    const groups: Record<string, ChatSession[]> = {};
    chats.forEach((chat) => {
      const groupKey = getChatDateGroup(chat.createdAt);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(chat);
    });
    return groups;
  }, [chats]);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
            <img src={OMNISCIENT_LOGO_URL} alt="ISRO" className="size-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Omniscient</p>
            <p className="text-[11px] text-muted-foreground">Workspace</p>
          </div>
        </div>
        {onClose ? (
          <IconButton label="Close sidebar" onClick={onClose}>
            <X />
          </IconButton>
        ) : null}
      </div>
      <div className="space-y-3 p-3">
        <Button className="w-full justify-start shadow-none" onClick={onNew}>
          <Plus />
          New chat
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search conversations"
            className="h-9 bg-background pl-9 shadow-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {Object.keys(groupedChats).length ? (
          Object.entries(groupedChats).map(([group, items]) => (
            <div key={group} className="mb-5">
              <p className="px-2 pb-1.5 text-[11px] font-medium text-muted-foreground">{group}</p>
              <div className="space-y-0.5">
                {items.map((chat) => (
                  <Button
                    key={chat.id}
                    variant="ghost"
                    onClick={() => {
                      onSelect(chat.id);
                      onClose?.();
                    }}
                    className={`h-auto w-full justify-start overflow-hidden px-2.5 py-2.5 text-left text-[13px] font-normal ${
                      activeId === chat.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                    }`}
                  >
                    <MessageSquareText className="size-3.5 shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            {query ? "No conversations match your search." : "No conversations recorded yet."}
          </div>
        )}
      </div>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {userDisplayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || <User className="size-4" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{userDisplayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{userRole}</p>
            </div>
          </div>
          <IconButton
            label="Log out"
            onClick={onLogout}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <LogOut />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}

function MarkdownText({ content }: { content: string }) {
  const renderInline = (line: string) =>
    line
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      );
  return (
    <div className="space-y-2.5 text-sm leading-6">
      {content.split("\n").map((line, index) => {
        if (line.startsWith("### "))
          return (
            <h3 key={index} className="pt-1 text-sm font-semibold">
              {line.slice(4)}
            </h3>
          );
        if (line.startsWith("- "))
          return (
            <div key={index} className="flex gap-2 pl-1">
              <span aria-hidden>•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        if (!line) return <div key={index} className="h-1" />;
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function ChatMessages({
  messages,
  images,
  loading,
  onPreview,
  emptyTitle = "Analysis Workspace",
  emptyText = "Upload an image and ask a question to begin.",
}: {
  messages: Message[];
  images: AnalysisImage[];
  loading: boolean;
  onPreview: (image: AnalysisImage) => void;
  emptyTitle?: string;
  emptyText?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  if (!messages.length && !loading) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex size-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1 shadow-xs">
          <img src={OMNISCIENT_LOGO_URL} alt="ISRO" className="size-full object-contain" />
        </div>
        <h2 className="text-lg font-semibold">{emptyTitle}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      {messages.map((message) => {
        const attached =
          message.imageIds
            ?.map((id) => images.find((image) => image.id === id))
            .filter((image): image is AnalysisImage => Boolean(image)) ?? [];
        return (
          <article
            key={message.id}
            className={`mb-7 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={message.role === "user" ? "max-w-[84%]" : "w-full max-w-[92%]"}>
              {attached.length ? (
                <div className="mb-2 flex flex-wrap justify-end gap-2">
                  {attached.map((image) => (
                    <button
                      type="button"
                      key={image.id}
                      onClick={() => onPreview(image)}
                      className="group relative overflow-hidden rounded-md border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <img
                        src={image.src}
                        alt={image.name}
                        className="h-28 w-36 object-cover transition-transform group-hover:scale-[1.02]"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[10px] text-white">
                        {image.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div
                className={
                  message.role === "user"
                    ? "rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground"
                    : "px-1 text-foreground"
                }
              >
                <MarkdownText content={message.content} />
              </div>
              <p
                className={`mt-1.5 text-[10px] text-muted-foreground ${
                  message.role === "user" ? "text-right" : "pl-1"
                }`}
              >
                {message.time}
              </p>
            </div>
          </article>
        );
      })}
      {loading ? (
        <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:400ms]" />
          </div>
          <span>Processing query...</span>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

function ChatInput({
  value,
  onValue,
  pendingImages,
  onFiles,
  onRemovePending,
  onSend,
  loading,
  placeholder,
}: {
  value: string;
  onValue: (value: string) => void;
  pendingImages: AnalysisImage[];
  onFiles: (files: FileList | File[]) => void;
  onRemovePending: (id: string) => void;
  onSend: () => void;
  loading: boolean;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-5 sm:px-8">
      <div className="rounded-xl border border-input bg-card p-2 shadow-sm">
        {pendingImages.length ? (
          <div className="flex gap-2 overflow-x-auto p-1 pb-2">
            {pendingImages.map((image) => (
              <div key={image.id} className="relative shrink-0">
                <img
                  src={image.src}
                  alt={image.name}
                  className="h-16 w-20 rounded-md border border-border object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute -right-1.5 -top-1.5 size-5 rounded-full"
                  onClick={() => onRemovePending(image.id)}
                  aria-label={`Remove ${image.name}`}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <Textarea
          value={value}
          onChange={(event) => onValue(event.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          className="min-h-12 resize-none border-0 bg-transparent px-2 py-3 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/80 placeholder:leading-6 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between px-1 pb-0.5">
          <div>
            <IconButton label="Attach images" onClick={() => inputRef.current?.click()}>
              <Paperclip />
            </IconButton>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/tiff,.tif,.tiff"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) onFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          <Button
            type="button"
            size="icon"
            className="rounded-full"
            onClick={onSend}
            disabled={loading || (!value.trim() && !pendingImages.length)}
            aria-label="Send message"
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageLibrary({
  images,
  titleCount,
  onPreview,
  onClose,
}: {
  images: AnalysisImage[];
  titleCount?: string | undefined;
  onPreview: (image: AnalysisImage) => void;
  onClose?: (() => void) | undefined;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
        <div>
          <h2 className="text-sm font-semibold">Image Library</h2>
          {titleCount ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{titleCount}</p>
          ) : null}
        </div>
        {onClose ? (
          <IconButton label="Close library" onClick={onClose}>
            <X />
          </IconButton>
        ) : (
          <Images className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {images.length ? (
          <div className="grid grid-cols-2 gap-3">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onPreview(image)}
                className="group overflow-hidden rounded-md border border-border bg-card text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={image.src}
                    alt={image.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="size-3.5" />
                  </span>
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] font-medium">{image.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDate(image.date)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-border bg-card">
              <Images className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No images uploaded</p>
            <p className="mt-1 max-w-[180px] text-xs leading-5 text-muted-foreground">
              Images attached to this session will appear here.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function TimeSeriesImageCard({
  image,
  onRemove,
  onPreview,
}: {
  image: AnalysisImage;
  onRemove: (id: string) => void;
  onPreview: (image: AnalysisImage) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <button
        type="button"
        className="relative block aspect-[16/10] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => onPreview(image)}
      >
        <img
          src={image.src}
          alt={image.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md bg-black/60 text-white">
          <ZoomIn className="size-3.5" />
        </span>
      </button>
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{image.name}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3" />
            {formatDate(image.date)}
          </p>
        </div>
        <IconButton
          label={`Remove ${image.name}`}
          onClick={() => onRemove(image.id)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Trash2 />
        </IconButton>
      </div>
    </article>
  );
}

function AddImageDialog({
  open,
  onOpenChange,
  onAdd,
  atLimit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (file: File, date: string) => void;
  atLimit: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setDate("");
    setError("");
  };

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    const valid =
      /\.(png|jpe?g|tiff?)$/i.test(candidate.name) ||
      ["image/png", "image/jpeg", "image/tiff"].includes(candidate.type);
    if (!valid) {
      setError("Please select a PNG, JPG, or GeoTIFF file.");
      return;
    }
    setFile(candidate);
    setError("");
  };

  const submit = () => {
    if (atLimit) return setError("Maximum number of images reached.");
    if (!file) return setError("Please select an image file.");
    if (!date) return setError("Please specify the capture date.");
    onAdd(file, date);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Add Time-Series Image</DialogTitle>
          <DialogDescription>
            Upload an image observation along with its capture date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLButtonElement>) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }}
            className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/40 px-5 py-9 text-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Upload className="mb-3 size-5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {file ? file.name : "Drag and drop your file here"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "or click to browse"}
            </span>
            <span className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground">
              PNG · JPG · GeoTIFF
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/tiff,.tif,.tiff"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <div>
            <label htmlFor="image-date" className="mb-1.5 block text-xs font-medium">
              Capture Date
            </label>
            <Input
              id="image-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setError("");
              }}
            />
          </div>
          {error ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={atLimit}>
            Add Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImagePreview({ image, onClose }: { image: AnalysisImage | null; onClose: () => void }) {
  return (
    <Dialog
      open={Boolean(image)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden rounded-lg p-3 sm:p-4">
        <DialogHeader className="pr-10">
          <DialogTitle className="truncate text-base">{image?.name}</DialogTitle>
          <DialogDescription>{image ? formatDate(image.date) : "Image preview"}</DialogDescription>
        </DialogHeader>
        {image ? (
          <div className="overflow-hidden rounded-md border border-border bg-muted">
            <img src={image.src} alt={image.name} className="max-h-[72vh] w-full object-contain" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LoginPage({ onGuestLogin }: { onGuestLogin: () => void }) {
  return (
    <main className="login-shell min-h-dvh overflow-hidden text-foreground">
      <div className="login-video-pane" aria-hidden="true">
        <video
          className="login-background-video"
          autoPlay
          muted
          loop
          playsInline
          src={LOGIN_BACKGROUND_VIDEO_URL}
        />
      </div>
      <div className="login-panel">
        <section className="w-full max-w-[420px]">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="login-brand-mark mb-4 flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5">
              <img src={OMNISCIENT_LOGO_URL} alt="ISRO" className="size-full object-contain" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary/90">
              Omniscient
            </p>
            <p className="login-shell-subtitle mt-2 text-sm">Geospatial intelligence workspace</p>
          </div>

          <div className="login-card rounded-2xl border border-border p-6 sm:p-8">
            <div className="mb-7">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Guest access
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Explore the workspace
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Continue as a guest to start analyzing geospatial imagery.
              </p>
            </div>

            <Button
              type="button"
              className="h-11 w-full justify-center px-4"
              onClick={onGuestLogin}
            >
              Continue as Guest
            </Button>

            <div className="mt-7 flex items-center justify-center border-t border-border/70 pt-5 text-xs text-muted-foreground">
              No account or password required
            </div>
          </div>

          <p className="login-shell-footer mt-6 text-center text-xs">
            Monitor imagery. Understand change. Act with clarity.
          </p>
        </section>
      </div>
    </main>
  );
}

function MobileDrawer({
  open,
  side,
  children,
  onClose,
  label,
}: {
  open: boolean;
  side: "left" | "right";
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label={`Close ${label}`}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 w-[min(88vw,320px)] border-border bg-background shadow-lg ${
          side === "left" ? "left-0 border-r" : "right-0 border-l"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function ImageAnalysisPlatform({
  onSendMessage,
  onSendTimeSeriesQuery,
  userDisplayName = "Active Analyst",
  userRole = "Session User",
}: ImageAnalysisPlatformProps) {
  const [chats, setChats] = useState<ChatSession[]>(() => {
    const defaultId = makeId();
    return [
      {
        id: defaultId,
        title: "New Analysis",
        createdAt: Date.now(),
        messages: [],
        images: [],
      },
    ];
  });
  const [activeChatId, setActiveChatId] = useState<string>(() => chats[0]?.id || "");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("chatbot");
  const [chatText, setChatText] = useState("");
  const [pendingImages, setPendingImages] = useState<AnalysisImage[]>([]);
  const [seriesImages, setSeriesImages] = useState<AnalysisImage[]>([]);
  const [seriesMessages, setSeriesMessages] = useState<Message[]>([]);
  const [seriesText, setSeriesText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [preview, setPreview] = useState<AnalysisImage | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const localUrls = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      localUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0];

  const filteredChats = useMemo(
    () => chats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase())),
    [chats, search],
  );

  const sortedSeries = useMemo(
    () => [...seriesImages].sort((a, b) => a.date.localeCompare(b.date)),
    [seriesImages],
  );

  const filesToImages = (files: FileList | File[]): AnalysisImage[] =>
    Array.from(files)
      .filter((file) => file.type.startsWith("image/") || /\.(tif|tiff)$/i.test(file.name))
      .map((file) => {
        const src = URL.createObjectURL(file);
        localUrls.current.add(src);
        return {
          id: makeId(),
          name: file.name,
          date: new Date().toISOString().slice(0, 10),
          src,
          file,
          local: true,
        };
      });

  const releaseImage = (image?: AnalysisImage) => {
    if (image?.local) {
      URL.revokeObjectURL(image.src);
      localUrls.current.delete(image.src);
    }
  };

  const logout = () => {
    setAuthenticated(false);
    setSidebarOpen(false);
    setLibraryOpen(false);
  };

  const newChat = () => {
    const id = makeId();
    const newSession: ChatSession = {
      id,
      title: "New Analysis",
      createdAt: Date.now(),
      messages: [],
      images: [],
    };
    setChats((current) => [newSession, ...current]);
    setActiveChatId(id);
    setTab("chatbot");
    setSearch("");
    setSidebarOpen(false);
  };

  const addChatFiles = (files: FileList | File[]) =>
    setPendingImages((current) => [...current, ...filesToImages(files)]);

  const removePending = (id: string) =>
    setPendingImages((current) => {
      const image = current.find((item) => item.id === id);
      releaseImage(image);
      return current.filter((item) => item.id !== id);
    });

  const sendChat = async () => {
    if ((!chatText.trim() && !pendingImages.length) || chatLoading || !activeChat) return;

    const userContent = chatText.trim() || "Analyze attached images.";
    const additions = [...pendingImages];
    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: userContent,
      time: currentTime(),
      imageIds: additions.map((img) => img.id),
    };

    const isFirstUserMessage = activeChat.messages.length === 0;
    const computedTitle = isFirstUserMessage
      ? userContent.slice(0, 32).trim() + (userContent.length > 32 ? "..." : "")
      : activeChat.title;

    setChats((current) =>
      current.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title: computedTitle,
              images: [...chat.images, ...additions],
              messages: [...chat.messages, userMessage],
            }
          : chat,
      ),
    );

    setChatText("");
    setPendingImages([]);
    setChatLoading(true);

    try {
      const sender = onSendMessage ?? sendChatMessageToBackend;
      const assistantReply = await sender({
        message: userContent,
        images: additions,
        history: activeChat.messages,
        sessionId: activeChat.id,
      });

      const assistantMessage: Message = {
        id: makeId(),
        role: "assistant",
        content: assistantReply,
        time: currentTime(),
      };

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat,
        ),
      );
    } catch (err) {
      const errorMessage: Message = {
        id: makeId(),
        role: "assistant",
        content:
          err instanceof Error
            ? `An error occurred: ${err.message}`
            : "An error occurred while processing the request. Please try again.",
        time: currentTime(),
      };
      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? { ...chat, messages: [...chat.messages, errorMessage] }
            : chat,
        ),
      );
    } finally {
      setChatLoading(false);
    }
  };

  const addSeriesImage = (file: File, date: string) => {
    if (seriesImages.length >= MAX_TIME_SERIES_IMAGES) return;
    const [image] = filesToImages([file]);
    if (!image) return;
    image.date = date;
    setSeriesImages((current) => [...current, image].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const removeSeries = (id: string) =>
    setSeriesImages((current) => {
      const image = current.find((item) => item.id === id);
      releaseImage(image);
      return current.filter((item) => item.id !== id);
    });

  const sendSeries = async (prompt?: string) => {
    const text = (prompt ?? seriesText).trim();
    if (!text || seriesLoading) return;

    if (seriesImages.length < 2) {
      setSeriesMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: "Please add at least 2 dated images to conduct a time-series comparison.",
          time: currentTime(),
        },
      ]);
      return;
    }

    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: text,
      time: currentTime(),
    };

    setSeriesMessages((current) => [...current, userMessage]);
    setSeriesText("");
    setSeriesLoading(true);

    try {
      const sender = onSendTimeSeriesQuery ?? sendTimeSeriesQueryToBackend;
      const assistantReply = await sender({
        query: text,
        images: sortedSeries,
        history: seriesMessages,
      });

      setSeriesMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: assistantReply,
          time: currentTime(),
        },
      ]);
    } catch (err) {
      setSeriesMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content:
            err instanceof Error
              ? `An error occurred: ${err.message}`
              : "Unable to process the time-series analysis at this moment.",
          time: currentTime(),
        },
      ]);
    } finally {
      setSeriesLoading(false);
    }
  };

  if (!authenticated)
    return (
      <LoginPage
        onGuestLogin={() => {
          setTab("chatbot");
          setAuthenticated(true);
        }}
      />
    );
  if (!activeChat) return null;
  const activeLibrary = tab === "chatbot" ? activeChat.images : sortedSeries;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-workspace h-dvh overflow-hidden bg-background text-foreground">
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)_300px]">
          <div className="hidden min-h-0 border-r border-border lg:block">
            <Sidebar
              chats={filteredChats}
              activeId={activeChat.id}
              query={search}
              userDisplayName={userDisplayName}
              userRole={userRole}
              onQuery={setSearch}
              onSelect={setActiveChatId}
              onNew={newChat}
              onLogout={logout}
            />
          </div>
          <main className="flex min-h-0 min-w-0 flex-col bg-background">
            <header className="flex h-16 shrink-0 items-center border-b border-border px-3 sm:px-5">
              <IconButton
                label="Open sidebar"
                className="mr-2 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu />
              </IconButton>
              <nav aria-label="Workspace views" className="flex h-full items-end gap-6">
                <button
                  type="button"
                  onClick={() => setTab("chatbot")}
                  className={`relative h-full px-1 text-sm transition-colors ${
                    tab === "chatbot"
                      ? "font-medium text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Chatbot
                </button>
                <button
                  type="button"
                  onClick={() => setTab("time-series")}
                  className={`relative h-full px-1 text-sm transition-colors ${
                    tab === "time-series"
                      ? "font-medium text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Time-Series
                </button>
              </nav>
              <div className="ml-auto flex items-center gap-1">
                <span className="mr-2 hidden text-[11px] text-muted-foreground sm:inline">
                  {tab === "chatbot" ? activeChat.title : "Temporal Comparison"}
                </span>
                <IconButton
                  label="Open image library"
                  className="lg:hidden"
                  onClick={() => setLibraryOpen(true)}
                >
                  <Images />
                </IconButton>
              </div>
            </header>

            {tab === "chatbot" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ChatMessages
                    messages={activeChat.messages}
                    images={activeChat.images}
                    loading={chatLoading}
                    onPreview={setPreview}
                  />
                </div>
                <ChatInput
                  value={chatText}
                  onValue={setChatText}
                  pendingImages={pendingImages}
                  onFiles={addChatFiles}
                  onRemovePending={removePending}
                  onSend={sendChat}
                  loading={chatLoading}
                  placeholder="Ask a question or upload images..."
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
                  <section>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h1 className="text-xl font-semibold">Time-Series Workspace</h1>
                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
                          Upload 2 to {MAX_TIME_SERIES_IMAGES} dated observations to track changes
                          and anomalies over time.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          {seriesImages.length} / {MAX_TIME_SERIES_IMAGES} images
                        </span>
                        <Button
                          onClick={() => setAddOpen(true)}
                          disabled={seriesImages.length >= MAX_TIME_SERIES_IMAGES}
                        >
                          <Plus />
                          Add Image
                        </Button>
                      </div>
                    </div>

                    {seriesImages.length < 2 ? (
                      <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <Clock3 className="size-4" />
                        Upload at least 2 dated images to activate time-series comparison.
                      </div>
                    ) : null}

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                      {sortedSeries.map((image) => (
                        <TimeSeriesImageCard
                          key={image.id}
                          image={image}
                          onRemove={removeSeries}
                          onPreview={setPreview}
                        />
                      ))}
                    </div>
                  </section>

                  <div className="my-8 border-t border-border" />

                  <section>
                    <div>
                      <h2 className="text-base font-semibold">Time-Series Assistant</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Query chronological differences across the loaded dataset. Every query sent
                        here also asks the backend to run a time-series analysis over the{" "}
                        {seriesImages.length} attached image
                        {seriesImages.length === 1 ? "" : "s"}.
                      </p>
                    </div>
                    <div className="mt-4 min-h-[280px] rounded-lg border border-border bg-card">
                      <div className="max-h-[420px] min-h-[280px] overflow-y-auto">
                        <ChatMessages
                          messages={seriesMessages}
                          images={seriesImages}
                          loading={seriesLoading}
                          onPreview={setPreview}
                          emptyTitle="No time-series inquiries yet"
                          emptyText="Send a prompt below to evaluate temporal changes."
                        />
                      </div>
                      <ChatInput
                        value={seriesText}
                        onValue={setSeriesText}
                        pendingImages={[]}
                        onFiles={() => setAddOpen(true)}
                        onRemovePending={() => undefined}
                        onSend={() => sendSeries()}
                        loading={seriesLoading}
                        placeholder="Inquire about changes across dates..."
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}
          </main>
          <div className="hidden min-h-0 border-l border-border lg:block">
            <ImageLibrary
              images={activeLibrary}
              titleCount={
                tab === "time-series"
                  ? `${seriesImages.length} / ${MAX_TIME_SERIES_IMAGES} images`
                  : undefined
              }
              onPreview={setPreview}
            />
          </div>
        </div>

        <MobileDrawer
          open={sidebarOpen}
          side="left"
          onClose={() => setSidebarOpen(false)}
          label="sidebar"
        >
          <Sidebar
            chats={filteredChats}
            activeId={activeChat.id}
            query={search}
            userDisplayName={userDisplayName}
            userRole={userRole}
            onQuery={setSearch}
            onSelect={setActiveChatId}
            onNew={newChat}
            onLogout={logout}
            onClose={() => setSidebarOpen(false)}
          />
        </MobileDrawer>

        <MobileDrawer
          open={libraryOpen}
          side="right"
          onClose={() => setLibraryOpen(false)}
          label="image library"
        >
          <ImageLibrary
            images={activeLibrary}
            titleCount={
              tab === "time-series"
                ? `${seriesImages.length} / ${MAX_TIME_SERIES_IMAGES} images`
                : undefined
            }
            onPreview={setPreview}
            onClose={() => setLibraryOpen(false)}
          />
        </MobileDrawer>

        <AddImageDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdd={addSeriesImage}
          atLimit={seriesImages.length >= MAX_TIME_SERIES_IMAGES}
        />
        <ImagePreview image={preview} onClose={() => setPreview(null)} />
      </div>
    </TooltipProvider>
  );
}
