import type { ReactNode } from 'react';
import AppChatWidgetHost from '../AppChatWidgetHost';
import AppRatingPrompt from '../AppRatingPrompt';
import DealSurveyModal from '../DealSurveyModal';
import { ChatErrorBoundary } from '../ErrorBoundaries';
import MobilePushNotificationManager from '../MobilePushNotificationManager';
import NativePushRegistration from '../NativePushRegistration';
import OfflineIndicator from '../OfflineIndicator';
import ShareTargetHandler from '../ShareTargetHandler';
import WebPushRegistration from '../WebPushRegistration';
import type { AppContextType } from '../../types/appContext';
import type { Notification } from '../../types';

type PendingSurvey = {
  surveyId: string;
  leadId: string;
  vehicleName?: string;
};

type AppSharedChromeProps = {
  seo: ReactNode;
  userEmail?: string;
  sellerPushEnabled: boolean;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  profileMuteKeys?: string[];
  onNavigate: AppContextType['navigate'];
  pendingSurvey: PendingSurvey | null;
  onSurveyDone: () => void;
  chatInlineLaunch: boolean;
  onCloseChat: () => void;
  onTestDriveResponse: (
    conversationId: string,
    messageId: number,
    newStatus: 'confirmed' | 'rejected',
  ) => void | Promise<void>;
};

/**
 * Chrome both shells must mount: SEO, push, share target, offline, deal survey, chat.
 * Phone-only frame (MobileLayout, search, location) stays in App.tsx.
 */
export function AppSharedChrome({
  seo,
  userEmail,
  sellerPushEnabled,
  notifications,
  onNotificationClick,
  profileMuteKeys,
  onNavigate,
  pendingSurvey,
  onSurveyDone,
  chatInlineLaunch,
  onCloseChat,
  onTestDriveResponse,
}: AppSharedChromeProps) {
  return (
    <>
      {seo}
      <NativePushRegistration userEmail={userEmail} />
      <WebPushRegistration userEmail={userEmail} enabled={sellerPushEnabled} />
      <AppRatingPrompt />
      <MobilePushNotificationManager
        notifications={notifications}
        onNotificationClick={onNotificationClick}
        profileMuteKeys={profileMuteKeys}
      />
      <ShareTargetHandler onNavigate={onNavigate} />
      <OfflineIndicator />
      {pendingSurvey && (
        <DealSurveyModal
          surveyId={pendingSurvey.surveyId}
          leadId={pendingSurvey.leadId}
          vehicleName={pendingSurvey.vehicleName}
          onClose={onSurveyDone}
          onSubmitted={onSurveyDone}
        />
      )}
      <AppChatWidgetHost
        chatInlineLaunch={chatInlineLaunch}
        onClose={onCloseChat}
        onTestDriveResponse={onTestDriveResponse}
        ChatErrorBoundary={ChatErrorBoundary}
      />
    </>
  );
}
