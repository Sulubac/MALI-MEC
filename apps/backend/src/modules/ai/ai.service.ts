import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic: Anthropic;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  private async callClaude(systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<string> {
    if (!this.anthropic) {
      return 'AI service not configured. Please set ANTHROPIC_API_KEY.';
    }
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      return (response.content[0] as any).text;
    } catch (error) {
      this.logger.error('Claude API error:', error.message);
      throw new BadRequestException('AI service temporarily unavailable');
    }
  }

  async reviewDocument(documentId: string, context?: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        dossier: { include: { clients: { include: { client: true } } } },
      },
    });

    if (!document) throw new BadRequestException('Document not found');

    const system = `Tu es un assistant juridique expert en droit djiboutien. 
    Tu analyses des actes notariaux et fournis des conseils professionnels en français.
    Tu identifies les risques légaux, les clauses manquantes, et proposes des améliorations.
    Réponds toujours en JSON structuré.`;

    const prompt = `Analyse ce document notarial de type ${document.type}:
    
    Titre: ${document.title}
    Contenu: ${document.content || document.htmlContent || 'Non disponible'}
    ${context ? `Contexte additionnel: ${context}` : ''}
    
    Retourne un JSON avec:
    {
      "summary": "résumé de l'acte",
      "risks": [{"level": "LOW|MEDIUM|HIGH", "description": "..."}],
      "missingClauses": ["clause manquante..."],
      "suggestions": ["amélioration suggérée..."],
      "legalReferences": ["article de loi pertinent..."],
      "overallScore": 0-100,
      "recommendation": "APPROVE|REVISE|REJECT"
    }`;

    const result = await this.callClaude(system, prompt, 3000);

    try {
      const analysis = JSON.parse(result);
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          aiReviewed: true,
          aiSuggestions: analysis,
          aiRiskScore: analysis.overallScore,
        },
      });
      return analysis;
    } catch {
      return { raw: result, parsed: false };
    }
  }

  async assessDossierRisk(dossierId: string) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        clients: { include: { client: true } },
        documents: { select: { type: true, status: true } },
        property: true,
      },
    });

    if (!dossier) throw new BadRequestException('Dossier not found');

    const system = `Tu es un expert en conformité et gestion des risques pour un cabinet notarial à Djibouti.
    Tu évalues les risques AML/KYC, les risques légaux, et les risques opérationnels.
    Tu fournis une analyse structurée en français avec des recommandations concrètes.`;

    const clientInfo = dossier.clients.map(dc => ({
      type: dc.client.type,
      pepStatus: dc.client.pepStatus,
      kycStatus: dc.client.kycStatus,
      riskLevel: dc.client.riskLevel,
      nationality: dc.client.nationality,
    }));

    const prompt = `Évalue les risques pour ce dossier notarial:
    
    Type: ${dossier.type}
    Valeur estimée: ${dossier.estimatedValue} DJF
    Clients: ${JSON.stringify(clientInfo)}
    Documents: ${JSON.stringify(dossier.documents)}
    ${dossier.property ? `Bien: ${JSON.stringify({ type: dossier.property.type, value: dossier.property.estimatedValue })}` : ''}
    
    Retourne un JSON:
    {
      "overallRisk": "LOW|MEDIUM|HIGH|CRITICAL",
      "riskScore": 0-100,
      "factors": [{"category": "AML|LEGAL|OPERATIONAL", "description": "...", "level": "LOW|MEDIUM|HIGH"}],
      "amlFlags": ["indicateur suspect..."],
      "requiredActions": ["action obligatoire..."],
      "complianceScore": 0-100,
      "summary": "résumé des risques"
    }`;

    const result = await this.callClaude(system, prompt, 2000);

    try {
      const assessment = JSON.parse(result);
      await this.prisma.dossier.update({
        where: { id: dossierId },
        data: {
          riskScore: assessment.riskScore,
          riskLevel: assessment.overallRisk,
          riskFactors: assessment.factors?.map((f: any) => f.description) || [],
          aiSummary: assessment.summary,
          complianceScore: assessment.complianceScore,
        },
      });
      return assessment;
    } catch {
      return { raw: result, parsed: false };
    }
  }

  async searchLegalKnowledge(query: string, category?: string, language = 'FR') {
    const system = `Tu es un expert juridique spécialisé en droit djiboutien.
    Tu fournis des informations précises sur les lois, codes, et jurisprudences en vigueur à Djibouti.
    Tu cites toujours les articles de loi pertinents.
    Réponds en ${language === 'AR' ? 'arabe' : language === 'EN' ? 'anglais' : 'français'}.`;

    const prompt = `Recherche juridique: "${query}"
    ${category ? `Domaine: ${category}` : ''}
    
    Fournis une réponse structurée avec:
    1. Réponse directe à la question
    2. Articles de loi applicables (Code Civil Djiboutien, Code Commercial, etc.)
    3. Procédure notariale standard
    4. Points d'attention particuliers
    5. Références légales`;

    const result = await this.callClaude(system, prompt, 2500);
    return { query, result, language, timestamp: new Date() };
  }

  async generateDocumentContent(templateId: string, dossierId: string, variables: Record<string, string>) {
    const [template, dossier] = await Promise.all([
      this.prisma.documentTemplate.findUnique({ where: { id: templateId } }),
      this.prisma.dossier.findUnique({
        where: { id: dossierId },
        include: { clients: { include: { client: true } }, property: true },
      }),
    ]);

    if (!template) throw new BadRequestException('Template not found');

    const system = `Tu es un notaire expert à Djibouti.
    Tu rédiges des actes notariaux conformes au droit djiboutien, en utilisant la terminologie juridique appropriée.
    Tu t'assures que tous les éléments légaux obligatoires sont présents.`;

    const prompt = `Génère le contenu d'un acte notarial de type ${template.type}:
    
    Template de base:
    ${template.content}
    
    Variables à intégrer:
    ${JSON.stringify(variables, null, 2)}
    
    Contexte du dossier:
    ${dossier ? `Type: ${dossier.type}, Clients: ${dossier.clients.length}` : 'Non disponible'}
    
    Génère l'acte complet en HTML avec les mentions légales obligatoires djiboutiennes.`;

    const content = await this.callClaude(system, prompt, 4000);
    return { content, templateId, dossierId, generatedAt: new Date() };
  }

  async chat(message: string, context?: string, history?: Array<{ role: string; content: string }>) {
    if (!this.anthropic) {
      return {
        response: 'Service IA non configuré. Veuillez définir ANTHROPIC_API_KEY.',
        timestamp: new Date(),
      };
    }

    const system = `Tu es NotaryOS Assistant, un assistant juridique intelligent intégré dans le système de gestion notariale de Djibouti.
    Tu aides les notaires et leurs équipes avec:
    - Les questions juridiques djiboutiennes (droit civil, commercial, immobilier, famille)
    - La compréhension des actes notariaux
    - La recherche de textes de loi
    - Les procédures notariales
    - La gestion des dossiers
    
    ${context ? `Contexte actuel: ${context}` : ''}
    
    Réponds toujours en français de manière professionnelle, précise et concise.
    Cite les articles de loi lorsque pertinent.`;

    const messages: any[] = [];
    if (history?.length) {
      messages.push(...history.map(h => ({ role: h.role as any, content: h.content })));
    }
    messages.push({ role: 'user', content: message });

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system,
        messages,
      });
      return {
        response: (response.content[0] as any).text,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Chat error:', error.message);
      throw new BadRequestException('AI service temporarily unavailable');
    }
  }

  async extractOcr(documentId: string) {
    // OCR extraction - in production would use Tesseract or AWS Textract
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new BadRequestException('Document not found');

    // Placeholder for actual OCR
    const mockOcrData = {
      text: 'OCR extraction would process the document here',
      confidence: 0.95,
      fields: {},
    };

    await this.prisma.document.update({
      where: { id: documentId },
      data: { ocrProcessed: true, ocrText: mockOcrData.text, ocrData: mockOcrData },
    });

    return mockOcrData;
  }

  async summarizeDossier(dossierId: string) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        clients: { include: { client: { select: { firstName: true, lastName: true, companyName: true, type: true } } } },
        documents: { select: { type: true, status: true, title: true } },
        tasks: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
        timeline: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!dossier) throw new BadRequestException('Dossier not found');

    const system = `Tu es un assistant notarial expert. Tu génères des résumés clairs et concis de dossiers notariaux.`;

    const prompt = `Génère un résumé exécutif de ce dossier notarial:
    
    ${JSON.stringify({
      type: dossier.type,
      status: dossier.status,
      clients: dossier.clients.map(dc => ({ role: dc.role, ...dc.client })),
      documents: dossier.documents,
      pendingTasks: dossier.tasks.length,
      recentActivity: dossier.timeline.slice(0, 5),
    }, null, 2)}
    
    Inclus: état actuel, parties impliquées, actions en cours, prochaines étapes.`;

    const summary = await this.callClaude(system, prompt, 1000);
    await this.prisma.dossier.update({ where: { id: dossierId }, data: { aiSummary: summary } });
    return { summary, dossierId, generatedAt: new Date() };
  }
}
