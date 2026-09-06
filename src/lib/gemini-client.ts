import { GeminiReflectRequest, GeminiReflectResponse, RecommendationBatch } from '../types';
import { auth, getAppCheckToken } from './firebase';

function getLocalGuestReflection(params: GeminiReflectRequest): GeminiReflectResponse {
  const prompt = params.prompt.trim();
  const title =
    params.title && params.title !== 'Untitled Reflection'
      ? params.title
      : prompt.split(/\s+/).slice(0, 5).join(' ') || 'Mindful Reflection';

  return {
    content: `### Reflection: ${title}\n\nYou have captured an insightful observation in guest mode:\n\n> "${
      prompt.length > 120 ? prompt.slice(0, 120) + '...' : prompt
    }"\n\n- **Clarity & Perspective**: Articulating thoughts in writing anchors emotional balance.\n- **Actionable Step**: Focus on what lies in your direct sphere of control today.\n\n*Note: Sign in with Google to enable Cloud AI analysis, personalized recommendations, and multi-device sync.*`,
    title,
    summary: prompt.length > 90 ? prompt.slice(0, 90) + '...' : prompt,
    takeaways: [
      'Acknowledge emotions and thoughts without immediate judgment',
      'Clarify next micro-actions within your sphere of control',
      'Sustain daily reflective habits to foster mental resilience',
    ],
    suggestedQuestions: [
      'What is the most constructive response to this insight?',
      'How does this reflection align with your long-term intentions?',
    ],
    modelUsed: 'local-guest-mode',
  };
}

export async function requestGeminiReflection(params: GeminiReflectRequest): Promise<GeminiReflectResponse> {
  const currentUser = auth.currentUser;

  // If in guest mode, skip the backend call entirely and return local synthesis
  if (!currentUser || currentUser.uid.startsWith('guest_')) {
    return getLocalGuestReflection(params);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const token = await currentUser.getIdToken(true);
    headers['Authorization'] = `Bearer ${token}`;
  } catch (tokenErr) {
    console.warn('Could not acquire Firebase ID token:', tokenErr);
    throw new Error('Authentication failed: Could not acquire Firebase ID token.');
  }

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  const response = await fetch('/api/gemini/reflect', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    if (contentType.includes('application/json')) {
      try {
        const errData = await response.json();
        if (errData?.error) {
          errorMessage = errData.error;
        }
      } catch {
        // Ignore parsing error
      }
    }
    throw new Error(errorMessage);
  }

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.warn('Unexpected non-JSON response from /api/gemini/reflect:', text.slice(0, 200));
    throw new Error('Received unexpected non-JSON response from server.');
  }

  const data = await response.json();
  return data as GeminiReflectResponse;
}

export async function requestGeminiSummary(text: string): Promise<string> {
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid.startsWith('guest_')) {
    return `### Executive Summary\n\n${text.slice(0, 200)}...\n\n- Key perspective captured.\n- Priorities clarified.`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const token = await currentUser.getIdToken(true);
    headers['Authorization'] = `Bearer ${token}`;
  } catch (tokenErr) {
    console.warn('Could not acquire Firebase ID token:', tokenErr);
    throw new Error('Authentication failed: Could not acquire Firebase ID token.');
  }

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  const response = await fetch('/api/gemini/summarize', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error(`Failed to generate summary (${response.status})`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server.');
  }

  const data = await response.json();
  return data.summary;
}

export async function requestGeminiRecommendations(
  clientReflections?: Array<{
    title: string;
    summary?: string;
    primaryPrompt?: string;
    tags?: string[];
    mode?: string;
  }>,
  activeReflectionId?: string
): Promise<RecommendationBatch> {
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid.startsWith('guest_')) {
    throw new Error('Guest users must sign in to generate personalized AI recommendations.');
  }

  const token = await currentUser.getIdToken(true);
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) {
    reqHeaders['X-Firebase-AppCheck'] = appCheckToken;
  }

  const response = await fetch('/api/gemini/recommendations', {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      clientReflections: clientReflections ? clientReflections.slice(0, 5) : undefined,
      activeReflectionId: activeReflectionId || undefined,
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    if (contentType.includes('application/json')) {
      try {
        const errData = await response.json();
        if (errData?.error) {
          errorMessage = errData.error;
        }
      } catch {
        // Ignore
      }
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

