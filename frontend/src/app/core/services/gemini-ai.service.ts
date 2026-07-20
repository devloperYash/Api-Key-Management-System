import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DashboardStats } from '../models/usage.model';
import { environment } from '../../../environments/environment';

export interface AiInsightResult {
  summary: string;
  securityRecommendation: string;
  trafficAssessment: string;
  statusLevel: 'OPTIMAL' | 'ATTENTION' | 'CRITICAL';
}

@Injectable({ providedIn: 'root' })
export class GeminiAiService {
  private readonly http = inject(HttpClient);

  // Gemini API Key read dynamically from environment or fallback engine
  private readonly apiKey = (environment as any).geminiApiKey || '';
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  generateDashboardInsights(stats: DashboardStats): Observable<AiInsightResult> {
    if (!this.apiKey) {
      return of(this.getFallbackInsights(stats));
    }

    const promptText = `
You are an expert DevSecOps and API Gateway Analyst for KeyForge platform.
Analyze these real-time API metrics:
- Total API Calls Today: ${stats.totalApiCallsToday}
- Active API Keys: ${stats.activeKeyCount}
- Error Rate: ${stats.errorRatePercent}%
- Total Projects: ${stats.totalProjects}

Provide a concise json evaluation with 4 fields:
1. "summary": 1-2 sentence executive summary.
2. "securityRecommendation": 1 actionable security recommendation.
3. "trafficAssessment": 1 sentence traffic & rate limit assessment.
4. "statusLevel": "OPTIMAL" if errorRate < 2%, "ATTENTION" if errorRate between 2-5%, "CRITICAL" if errorRate > 5%.

Return ONLY valid JSON.
`;

    const body = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

    return this.http.post<any>(`${this.apiUrl}?key=${this.apiKey}`, body).pipe(
      map((res) => {
        try {
          const rawText = res.candidates[0].content.parts[0].text;
          const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return {
            summary: parsed.summary || 'Platform API traffic is functioning normally.',
            securityRecommendation: parsed.securityRecommendation || 'Ensure all production keys have rate limits and 24h grace period rotation enabled.',
            trafficAssessment: parsed.trafficAssessment || 'Call volume is steady within expected thresholds.',
            statusLevel: parsed.statusLevel || (stats.errorRatePercent > 2 ? 'ATTENTION' : 'OPTIMAL'),
          };
        } catch {
          return this.getFallbackInsights(stats);
        }
      }),
      catchError(() => of(this.getFallbackInsights(stats)))
    );
  }

  private getFallbackInsights(stats: DashboardStats): AiInsightResult {
    const isHighError = stats.errorRatePercent > 5;
    const isMediumError = stats.errorRatePercent > 2;

    return {
      summary: isHighError
        ? `Elevated error rate detected (${stats.errorRatePercent}%). Immediate security & gateway inspection recommended.`
        : `Platform operating at peak performance with ${stats.totalApiCallsToday} total API calls across ${stats.activeKeyCount} active keys.`,
      securityRecommendation: stats.activeKeyCount > 10
        ? 'High count of active keys detected. Review unrotated legacy keys and enforce 24-hour grace period rotations.'
        : 'Zero-trust SHA-256 storage enabled. All key creation and rotation events are actively audited.',
      trafficAssessment: isMediumError
        ? 'Rate limiting rules are actively throttling unauthorized or failing requests.'
        : 'API call distribution is healthy with optimal backend throughput.',
      statusLevel: isHighError ? 'CRITICAL' : isMediumError ? 'ATTENTION' : 'OPTIMAL',
    };
  }
}
