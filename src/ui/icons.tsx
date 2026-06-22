

export {
  Lock,
  LockOpen,
  LockKeyhole,
  ShieldCheck,
  ShieldAlert,
  Key,
  KeyRound,
  File,
  FileText,
  Folder,
  FolderOpen,
  Eye,
  EyeOff,
  X,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  History,
  Settings,
  Settings2,
  Download,
  Upload,
  Copy,
  Clipboard,
  Trash2,
  Plus,
  Minus,
  Square,
  RefreshCw,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderSearch,
  Zap,
  Timer,
  HardDrive,
  Cpu,
  Shield,
  Fingerprint,
  Wand2,
  Search,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  Globe,
} from "lucide-react";

export function Github({ size = 16, style, ...rest }: { size?: number; style?: React.CSSProperties; [k: string]: unknown }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.96c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.15v3.19c0 .31.21.68.8.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
