import * as React from 'react';
import { Suspense } from 'react';
import type { User } from '../../types';
import { useApp } from '../AppProvider';
import useIsMobileApp from '../../hooks/useIsMobileApp';
import useIsLgUp from '../../hooks/useIsLgUp';
import { DashboardErrorBoundary } from '../ErrorBoundaries';
import { DashboardSkeleton, MobileDashboardSkeleton } from '../app/AppViewSkeletons';
import {
  useSellerDashboardHandlers,
  validateSellerDashboardAccess,
  type SellerDashboardLocals,
} from '../../hooks/useSellerDashboardHandlers';
import { logInfo } from '../../utils/logger';

const Dashboard = React.lazy(() => import('../Dashboard'));
const MobileDashboard = React.lazy(() => import('../MobileDashboard'));

export type SellerDashboardRouteProps = {
  locals: SellerDashboardLocals;
};

type SellerDashboardContentProps = {
  currentUser: User;
  locals: SellerDashboardLocals;
  preferCompactDashboard: boolean;
};

const SellerDashboardContent: React.FC<SellerDashboardContentProps> = ({
  currentUser,
  locals,
  preferCompactDashboard,
}) => {
  const app = useApp();

  const handlers = useSellerDashboardHandlers({ app, currentUser, locals });

  if (preferCompactDashboard) {
    return (
      <DashboardErrorBoundary>
        <Suspense fallback={<MobileDashboardSkeleton />}>
          <MobileDashboard
            currentUser={currentUser}
            userVehicles={handlers.enrichedSellerVehicles}
            reportedVehicles={handlers.sellerReportedVehicles}
            conversations={handlers.sellerConversations}
            onNavigate={handlers.navigate}
            onEditVehicle={(vehicle) => {
              logInfo('Edit vehicle:', vehicle);
            }}
            onDeleteVehicle={handlers.onDeleteVehicle}
            onMarkAsSold={handlers.onMarkAsSold}
            onMarkAsUnsold={handlers.onMarkAsUnsold}
            onAddMultipleVehicles={handlers.onAddMultipleVehicles}
            onRequestCertification={handlers.onRequestCertification}
            onFeatureListing={handlers.onFeatureListing}
            onSendMessage={handlers.sendMessage}
            onMarkConversationAsRead={handlers.markAsRead}
            onOfferResponse={(conversationId, messageId, response, counterPrice) => {
              handlers.onOfferResponse(
                conversationId,
                parseInt(messageId, 10),
                response as 'accepted' | 'rejected' | 'countered',
                counterPrice,
              );
            }}
            typingStatus={handlers.typingStatus}
            onUserTyping={(conversationId) => {
              handlers.toggleTyping(conversationId, true);
            }}
            onMarkMessagesAsRead={(conversationId, _readerRole) => {
              handlers.markAsRead(conversationId, { readerRole: _readerRole, forceReadState: true });
            }}
            onFlagContent={handlers.flagContent}
            onLogout={handlers.handleLogoutAll}
            onViewVehicle={handlers.selectVehicle}
            onAddVehicle={handlers.onAddVehicle}
            onUpdateVehicle={handlers.onUpdateVehicle}
            vehicleData={handlers.vehicleData}
            onUpdateProfile={handlers.onUpdateProfile}
            onUpdateSellerProfile={handlers.onUpdateSellerProfile}
            notifications={handlers.sellerNotifications}
            onNotificationClick={handlers.handleNotificationClick}
            onMarkNotificationsAsRead={handlers.handleMarkNotificationsAsRead}
            addToast={handlers.addToast}
            onSetConversationReadState={(conversationId, isRead) =>
              handlers.setConversationReadState(conversationId, 'seller', isRead)
            }
            onMarkAllAsReadBySeller={() => void handlers.markAllVisibleAsRead('seller')}
            onSellerOpenChat={handlers.handleSellerOpenChatFromDashboard}
          />
        </Suspense>
      </DashboardErrorBoundary>
    );
  }

  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard
          seller={currentUser}
          sellerVehicles={handlers.enrichedSellerVehicles}
          reportedVehicles={handlers.sellerReportedVehicles}
          onAddVehicle={async (vehicleData, isFeaturing = false) => {
            await handlers.onAddVehicle(vehicleData, isFeaturing);
          }}
          onAddMultipleVehicles={handlers.onAddMultipleVehicles}
          onUpdateVehicle={handlers.onUpdateVehicle}
          onDeleteVehicle={handlers.onDeleteVehicle}
          onMarkAsSold={handlers.onMarkAsSold}
          onMarkAsUnsold={handlers.onMarkAsUnsold}
          conversations={handlers.sellerConversations}
          onSellerSendMessage={(conversationId, messageText, type, payload) => {
            if (type || payload) {
              handlers.sendMessageWithType(conversationId, messageText, type, payload);
            } else {
              handlers.sendMessage(conversationId, messageText);
            }
          }}
          onMarkConversationAsReadBySeller={(conversationId) =>
            handlers.markAsRead(conversationId, { readerRole: 'seller', forceReadState: true })
          }
          onSetConversationReadState={(conversationId, isRead) =>
            handlers.setConversationReadState(conversationId, 'seller', isRead)
          }
          onMarkAllAsReadBySeller={() => void handlers.markAllVisibleAsRead('seller')}
          typingStatus={handlers.typingStatus}
          onUserTyping={(conversationId) => handlers.toggleTyping(conversationId, true)}
          onUserStoppedTyping={(conversationId) => handlers.toggleTyping(conversationId, false)}
          onMarkMessagesAsRead={(conversationId, _readerRole) =>
            handlers.markAsRead(conversationId, { readerRole: 'seller', forceReadState: true })
          }
          onClearChat={handlers.clearConversationMessages}
          onArchiveConversation={handlers.archiveConversation}
          onDeleteConversation={handlers.deleteConversation}
          onUpdateSellerProfile={handlers.onUpdateSellerProfile}
          vehicleData={handlers.vehicleData}
          onFeatureListing={handlers.onFeatureListing}
          onRequestCertification={handlers.onRequestCertification}
          onNavigate={handlers.navigate}
          onTestDriveResponse={handlers.handleTestDriveResponse}
          allVehicles={app.vehicles || []}
          onOfferResponse={handlers.onOfferResponse}
          onViewVehicle={handlers.selectVehicle}
          onSellerOpenChat={handlers.handleSellerOpenChatFromDashboard}
          chatPeerOnlineByConversationId={handlers.chatPeerOnlineByConversationId}
          onNotify={(message, type = 'info') => handlers.addToast(message, type)}
        />
      </Suspense>
    </DashboardErrorBoundary>
  );
};

export const SellerDashboardRoute: React.FC<SellerDashboardRouteProps> = ({ locals }) => {
  const { isMobileApp } = useIsMobileApp();
  const isLgUp = useIsLgUp();
  const preferCompactDashboard = isMobileApp || !isLgUp;
  const { currentUser, navigate } = useApp();

  if (!validateSellerDashboardAccess(currentUser, navigate)) {
    return null;
  }

  return (
    <SellerDashboardContent
      currentUser={currentUser}
      locals={locals}
      preferCompactDashboard={preferCompactDashboard}
    />
  );
};

export default SellerDashboardRoute;
