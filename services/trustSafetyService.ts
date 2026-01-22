import type {
  VerificationStatus,
  TrustScore,
  SafetyReport,
  ResponseTimeStats,
  User,
  Conversation,
} from '../types';

// ============================================
// VERIFICATION MANAGEMENT
// ============================================

// Initialize verification status
export function initVerificationStatus(): VerificationStatus {
  return {
    phoneVerified: false,
    emailVerified: false,
    govtIdVerified: false,
  };
}

// Verify phone number
export function verifyPhone(status: VerificationStatus): VerificationStatus {
  return {
    ...status,
    phoneVerified: true,
    phoneVerifiedAt: new Date().toISOString(),
  };
}

// Verify email
export function verifyEmail(status: VerificationStatus): VerificationStatus {
  return {
    ...status,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
  };
}

// Verify government ID
export function verifyGovtId(
  status: VerificationStatus,
  idType: 'aadhaar' | 'pan' | 'driving_license',
  idNumber: string
): VerificationStatus {
  return {
    ...status,
    govtIdVerified: true,
    govtIdVerifiedAt: new Date().toISOString(),
    govtIdType: idType,
    govtIdNumber: idNumber, // Should be encrypted/hashed in production
  };
}

// Get verification count
export function getVerificationCount(status: VerificationStatus): number {
  let count = 0;
  if (status.phoneVerified) count++;
  if (status.emailVerified) count++;
  if (status.govtIdVerified) count++;
  return count;
}

// ============================================
// TRUST SCORE CALCULATION
// ============================================

// Calculate trust score (0-100)
export function calculateTrustScore(
  user: User,
  conversations: Conversation[] = []
): TrustScore {
  let score = 0;
  
  // Verification points (max 30)
  const verificationStatus = user.verificationStatus || initVerificationStatus();
  const verificationCount = getVerificationCount(verificationStatus);
  score += verificationCount * 10; // 10 points per verification
  
  // Response rate points (max 25)
  const responseRate = user.responseRate || 0;
  score += (responseRate / 100) * 25;
  
  // Positive reviews points (max 20)
  const averageRating = user.averageRating || 0;
  const ratingCount = user.ratingCount || 0;
  if (ratingCount > 0) {
    score += (averageRating / 5) * 20;
  }
  
  // Account age points (max 15)
  if (user.createdAt) {
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    // 1 point per month, max 15
    score += Math.min((accountAgeDays / 30) * 1, 15);
  }
  
  // Successful deals points (max 10)
  const soldListings = user.soldListings || 0;
  score += Math.min(soldListings, 10);
  
  // Cap at 100
  score = Math.min(Math.round(score), 100);
  
  return {
    userId: user.email,
    score,
    factors: {
      verificationsComplete: verificationCount,
      responseRate: Math.round(responseRate),
      positiveReviews: ratingCount,
      accountAge: user.createdAt ? Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ) : 0,
      successfulDeals: soldListings,
    },
    lastCalculated: new Date().toISOString(),
  };
}

// Get trust badge based on score
export function getTrustBadge(score: number): {
  label: string;
  color: string;
  icon: string;
} | null {
  if (score >= 90) {
    return { label: 'Highly Trusted', color: '#10B981', icon: '✓✓✓' };
  } else if (score >= 70) {
    return { label: 'Trusted', color: '#3B82F6', icon: '✓✓' };
  } else if (score >= 50) {
    return { label: 'Verified', color: '#F59E0B', icon: '✓' };
  } else {
    return null; // Don't return badge info for new sellers
  }
}

// ============================================
// RESPONSE TIME TRACKING
// ============================================

// Calculate response time statistics
export function calculateResponseStats(
  userId: string,
  conversations: Conversation[]
): ResponseTimeStats {
  const userConversations = conversations.filter(
    c => c.sellerId === userId || c.customerId === userId
  );
  
  let totalQueries = 0;
  let respondedQueries = 0;
  let totalResponseTime = 0;
  let responseCount = 0;
  
  userConversations.forEach(conv => {
    const isSeller = conv.sellerId === userId;
    const messages = conv.messages;
    
    for (let i = 0; i < messages.length - 1; i++) {
      const currentMsg = messages[i];
      const nextMsg = messages[i + 1];
      
      // Check if this is a query to the user
      const isQuery = isSeller
        ? currentMsg.sender === 'user'
        : currentMsg.sender === 'seller';
      
      const isResponse = isSeller
        ? nextMsg.sender === 'seller'
        : nextMsg.sender === 'user';
      
      if (isQuery) {
        totalQueries++;
        
        if (isResponse) {
          respondedQueries++;
          
          // Calculate response time in minutes
          const queryTime = new Date(currentMsg.timestamp).getTime();
          const responseTime = new Date(nextMsg.timestamp).getTime();
          const diffMinutes = (responseTime - queryTime) / (1000 * 60);
          
          totalResponseTime += diffMinutes;
          responseCount++;
        }
      }
    }
  });
  
  const averageResponseMinutes = responseCount > 0
    ? Math.round(totalResponseTime / responseCount)
    : 0;
  
  const responseRate = totalQueries > 0
    ? Math.round((respondedQueries / totalQueries) * 100)
    : 0;
  
  return {
    userId,
    averageResponseMinutes,
    responseRate,
    totalQueries,
    respondedQueries,
    lastCalculated: new Date().toISOString(),
  };
}

// Get response time badge
export function getResponseTimeBadge(stats: ResponseTimeStats): {
  label: string;
  color: string;
} {
  if (stats.averageResponseMinutes <= 30) {
    return { label: 'Responds within 30 min', color: '#10B981' };
  } else if (stats.averageResponseMinutes <= 60) {
    return { label: 'Responds within 1 hour', color: '#3B82F6' };
  } else if (stats.averageResponseMinutes <= 180) {
    return { label: 'Responds within 3 hours', color: '#F59E0B' };
  } else {
    return { label: 'Usually responds late', color: '#6B7280' };
  }
}

// ============================================
// SAFETY REPORTS
// ============================================

const SAFETY_REPORTS_KEY = 'reride_safety_reports';

// Create safety report
export function createSafetyReport(
  reportedBy: string,
  targetType: 'vehicle' | 'user' | 'conversation',
  targetId: string | number,
  reason: 'scam' | 'fake_listing' | 'inappropriate' | 'spam' | 'other',
  description: string
): SafetyReport {
  try {
    const stored = localStorage.getItem(SAFETY_REPORTS_KEY);
    const reports: SafetyReport[] = stored ? JSON.parse(stored) : [];
    
    const newReport: SafetyReport = {
      id: `report_${Date.now()}`,
      reportedBy,
      targetType,
      targetId,
      reason,
      description,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    reports.push(newReport);
    localStorage.setItem(SAFETY_REPORTS_KEY, JSON.stringify(reports));
    
    return newReport;
  } catch (error) {
    console.error('Error creating safety report:', error);
    throw error;
  }
}

// Get safety reports
export function getSafetyReports(status?: string): SafetyReport[] {
  try {
    const stored = localStorage.getItem(SAFETY_REPORTS_KEY);
    if (!stored) return [];
    
    const reports: SafetyReport[] = JSON.parse(stored);
    
    if (status) {
      return reports.filter(r => r.status === status);
    }
    
    return reports;
  } catch (error) {
    console.error('Error getting safety reports:', error);
    return [];
  }
}

// Update safety report status
export function updateSafetyReportStatus(
  reportId: string,
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed',
  action?: string
): void {
  try {
    const stored = localStorage.getItem(SAFETY_REPORTS_KEY);
    if (!stored) return;
    
    const reports: SafetyReport[] = JSON.parse(stored);
    const index = reports.findIndex(r => r.id === reportId);
    
    if (index !== -1) {
      reports[index].status = status;
      if (action) reports[index].action = action;
      if (status === 'resolved') {
        reports[index].resolvedAt = new Date().toISOString();
      }
      
      localStorage.setItem(SAFETY_REPORTS_KEY, JSON.stringify(reports));
    }
  } catch (error) {
    console.error('Error updating safety report:', error);
    throw error;
  }
}

// Get reports for a specific target
export function getReportsForTarget(
  targetType: 'vehicle' | 'user' | 'conversation',
  targetId: string | number
): SafetyReport[] {
  try {
    const stored = localStorage.getItem(SAFETY_REPORTS_KEY);
    if (!stored) return [];
    
    const reports: SafetyReport[] = JSON.parse(stored);
    return reports.filter(r => r.targetType === targetType && r.targetId === targetId);
  } catch (error) {
    console.error('Error getting reports for target:', error);
    return [];
  }
}

// Check if item has been reported
export function hasBeenReported(
  targetType: 'vehicle' | 'user' | 'conversation',
  targetId: string | number
): boolean {
  const reports = getReportsForTarget(targetType, targetId);
  return reports.length > 0;
}

// ============================================
// SAFETY TIPS & GUIDELINES
// ============================================

// Get safety tips by category
export function getSafetyTips(category?: string): string[] {
  const allTips = {
    general: [
      'Always meet in a public place during daylight hours',
      'Never share bank details or OTP with anyone',
      'Verify vehicle documents before making payment',
    ],
    buyer: [
      'Test drive with seller present and valid documents',
      'Check vehicle history and registration details',
      'Avoid advance payments without proper agreement',
      'Get vehicle inspection done by mechanic',
    ],
    seller: [
      'Verify buyer identity before meeting',
      'Don\'t hand over vehicle until payment is confirmed',
      'Keep all transaction records',
      'Be cautious of unusual payment requests',
    ],
  };
  
  if (category && category in allTips) {
    return allTips[category as keyof typeof allTips];
  }
  
  return [...allTips.general, ...allTips.buyer, ...allTips.seller];
}

// ============================================
// BLOCKED USERS
// ============================================

const BLOCKED_USERS_KEY = 'reride_blocked_users';

// Block a user
export function blockUser(userId: string, blockedUserId: string, reason?: string): void {
  try {
    const stored = localStorage.getItem(BLOCKED_USERS_KEY);
    const blocked: Record<string, Array<{ userId: string; reason?: string; blockedAt: string }>> = 
      stored ? JSON.parse(stored) : {};
    
    if (!blocked[userId]) {
      blocked[userId] = [];
    }
    
    // Check if already blocked
    if (blocked[userId].some(b => b.userId === blockedUserId)) {
      return;
    }
    
    blocked[userId].push({
      userId: blockedUserId,
      reason,
      blockedAt: new Date().toISOString(),
    });
    
    localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blocked));
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
}

// Unblock a user
export function unblockUser(userId: string, blockedUserId: string): void {
  try {
    const stored = localStorage.getItem(BLOCKED_USERS_KEY);
    if (!stored) return;
    
    const blocked: Record<string, Array<{ userId: string; reason?: string; blockedAt: string }>> = 
      JSON.parse(stored);
    
    if (blocked[userId]) {
      blocked[userId] = blocked[userId].filter(b => b.userId !== blockedUserId);
      localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blocked));
    }
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
}

// Check if user is blocked
export function isUserBlocked(userId: string, checkUserId: string): boolean {
  try {
    const stored = localStorage.getItem(BLOCKED_USERS_KEY);
    if (!stored) return false;
    
    const blocked: Record<string, Array<{ userId: string; reason?: string; blockedAt: string }>> = 
      JSON.parse(stored);
    
    return blocked[userId]?.some(b => b.userId === checkUserId) || false;
  } catch (error) {
    console.error('Error checking if user is blocked:', error);
    return false;
  }
}

