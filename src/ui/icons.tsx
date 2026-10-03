/** Lucide replacements for frontend icons, sized like the former inline icons. */
import { ArrowLeft, ArrowRight, Ban, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, CircleCheck, CircleX, Clock3, CodeXml, Copy, File, FlaskConical, History, House, Inbox, List, LockKeyhole, LogOut, Menu, Minus, Pin, Play, Plus, RotateCcw, Search, Send, Settings, ShieldCheck, Star, Trash2, TriangleAlert, Trophy, UserRound, UserRoundPlus, Users, X, type LucideIcon, type LucideProps } from 'lucide-react';

function icon(Component: LucideIcon) {
  return function FrontIcon({ size, style, ...props }: LucideProps) {
    return <Component {...props} size={size ?? style?.fontSize ?? 16} style={{ verticalAlign: '-0.125em', ...style }} />;
  };
}

export const UserOutlined = icon(UserRound);
export const ClockCircleOutlined = icon(Clock3);
export const CalendarOutlined = icon(CalendarDays);
export const ReloadOutlined = icon(RotateCcw);
export const SearchOutlined = icon(Search);
export const CopyOutlined = icon(Copy);
export const CloseOutlined = icon(X);
export const TeamOutlined = icon(Users);
export const CaretDownOutlined = icon(ChevronDown);
export const CheckCircleOutlined = icon(CircleCheck);
export const TrophyOutlined = icon(Trophy);
export const LeftOutlined = icon(ChevronLeft);
export const CodeOutlined = icon(CodeXml);
export const LockOutlined = icon(LockKeyhole);
export const BellOutlined = icon(Bell);
export const PushpinOutlined = icon(Pin);
export const CaretRightOutlined = icon(Play);
export const StopOutlined = icon(Ban);
export const InboxOutlined = icon(Inbox);
export const CloseCircleOutlined = icon(CircleX);
export const CheckOutlined = icon(Check);
export const WarningOutlined = icon(TriangleAlert);
export const LogoutOutlined = icon(LogOut);
export const MenuOutlined = icon(Menu);
export const SettingOutlined = icon(Settings);
export const HomeOutlined = icon(House);
export const UnorderedListOutlined = icon(List);
export const ArrowLeftOutlined = icon(ArrowLeft);
export const StarFilled = icon(Star);
export const ArrowRightOutlined = icon(ArrowRight);
export const UserAddOutlined = icon(UserRoundPlus);
export const SafetyOutlined = icon(ShieldCheck);
export const StarOutlined = icon(Star);
export const DeleteOutlined = icon(Trash2);
export const ExperimentOutlined = icon(FlaskConical);
export const FileOutlined = icon(File);
export const HistoryOutlined = icon(History);
export const MinusOutlined = icon(Minus);
export const PlusOutlined = icon(Plus);
export const SendOutlined = icon(Send);
