import { PrismaClient, UserRole, ClientType, DossierType, DossierStatus, DocumentType, Language } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NotaryOS Djibouti database...');

  // Create admin user
  const adminPass = await bcrypt.hash('Admin2024!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cabinet-notarial-djibouti.dj' },
    update: {},
    create: {
      email: 'admin@cabinet-notarial-djibouti.dj',
      password: adminPass,
      firstName: 'Ibrahim',
      lastName: 'Hassan',
      role: UserRole.SUPER_ADMIN,
    },
  });

  const notaryPass = await bcrypt.hash('Notaire2024!', 12);
  const notary = await prisma.user.upsert({
    where: { email: 'notaire@cabinet-notarial-djibouti.dj' },
    update: {},
    create: {
      email: 'notaire@cabinet-notarial-djibouti.dj',
      password: notaryPass,
      firstName: 'Fatouma',
      lastName: 'Ali',
      role: UserRole.SENIOR_NOTARY,
    },
  });

  await prisma.user.upsert({
    where: { email: 'assistant@cabinet-notarial-djibouti.dj' },
    update: {},
    create: {
      email: 'assistant@cabinet-notarial-djibouti.dj',
      password: await bcrypt.hash('Assistant2024!', 12),
      firstName: 'Omar',
      lastName: 'Daoud',
      role: UserRole.LEGAL_ASSISTANT,
    },
  });

  // Sample clients
  const client1 = await prisma.client.upsert({
    where: { clientNumber: 'CLT-2024-00001' },
    update: {},
    create: {
      clientNumber: 'CLT-2024-00001',
      type: ClientType.INDIVIDUAL,
      firstName: 'Mohamed',
      lastName: 'Abdillahi',
      email: 'mohamed.abdillahi@email.dj',
      phone: '+25377123456',
      nationalIdNumber: 'DJ-2024-001234',
      address: 'Rue de Marseille, Djibouti-Ville',
      city: 'Djibouti',
      kycStatus: 'VERIFIED',
    },
  });

  const client2 = await prisma.client.upsert({
    where: { clientNumber: 'CLT-2024-00002' },
    update: {},
    create: {
      clientNumber: 'CLT-2024-00002',
      type: ClientType.COMPANY,
      companyName: 'Djibouti Commerce International SARL',
      registrationNumber: 'RC-DJ-2024-5678',
      email: 'contact@dci.dj',
      phone: '+25377654321',
      address: 'Boulevard de Gaulle, Zone Industrielle',
      city: 'Djibouti',
      kycStatus: 'VERIFIED',
    },
  });

  // Sample dossier
  const dossier = await prisma.dossier.upsert({
    where: { dossierNumber: 'SAL-2024-0001' },
    update: {},
    create: {
      dossierNumber: 'SAL-2024-0001',
      title: 'Vente Villa Zone C - Balbala',
      type: DossierType.SALE,
      status: DossierStatus.ACTIVE,
      description: 'Acte de vente d\'une villa de 250m² en zone C, quartier Balbala',
      assignedNotaryId: notary.id,
      createdById: admin.id,
      estimatedValue: 15000000,
      notaryFees: 450000,
      taxAmount: 225000,
      totalAmount: 15675000,
      deadlineAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clients: {
        create: [
          { clientId: client1.id, role: 'SELLER' },
          { clientId: client2.id, role: 'BUYER' },
        ],
      },
    },
  });

  // Document templates
  await prisma.documentTemplate.upsert({
    where: { id: 'tpl-power-attorney' },
    update: {},
    create: {
      id: 'tpl-power-attorney',
      name: 'Procuration Générale',
      nameAr: 'توكيل عام',
      type: DocumentType.POWER_OF_ATTORNEY,
      language: Language.FR,
      category: 'Actes personnels',
      description: 'Modèle de procuration générale conforme au droit djiboutien',
      variables: JSON.parse('["mandant_nom","mandant_cin","mandataire_nom","mandataire_cin","objet","date","lieu"]'),
      content: `<div class="notarial-act">
<h1>PROCURATION GÉNÉRALE</h1>
<p>Je soussigné(e), <strong>{{mandant_nom}}</strong>, porteur de la CIN N° {{mandant_cin}},</p>
<p>donne par les présentes procuration à <strong>{{mandataire_nom}}</strong>, porteur de la CIN N° {{mandataire_cin}},</p>
<p>pour : {{objet}}</p>
<p>Fait à {{lieu}}, le {{date}}</p>
<p>Le Mandant: ___________________</p>
<p>Le Notaire: ___________________</p>
</div>`,
    },
  });

  await prisma.documentTemplate.upsert({
    where: { id: 'tpl-sale-agreement' },
    update: {},
    create: {
      id: 'tpl-sale-agreement',
      name: 'Contrat de Vente Immobilière',
      nameAr: 'عقد بيع عقاري',
      type: DocumentType.SALE_AGREEMENT,
      language: Language.FR,
      category: 'Actes immobiliers',
      description: 'Modèle d\'acte authentique de vente immobilière',
      variables: JSON.parse('["vendeur_nom","acheteur_nom","bien_description","prix","date","notaire"]'),
      content: `<div class="notarial-act">
<h1>ACTE AUTHENTIQUE DE VENTE</h1>
<h2>République de Djibouti</h2>
<p>L'an {{date}}, par devant Maître {{notaire}}, notaire à Djibouti,</p>
<p><strong>A COMPARU :</strong></p>
<p>{{vendeur_nom}}, ci-après "le Vendeur"</p>
<p>{{acheteur_nom}}, ci-après "l'Acquéreur"</p>
<h3>DESCRIPTION DU BIEN</h3>
<p>{{bien_description}}</p>
<h3>PRIX</h3>
<p>Le présent bien est vendu au prix de {{prix}} Francs Djiboutiens.</p>
</div>`,
    },
  });

  // Settings
  await prisma.setting.upsert({
    where: { key: 'cabinet.name' },
    update: {},
    create: { key: 'cabinet.name', value: 'Cabinet Notarial de Djibouti', category: 'general', isPublic: true },
  });
  await prisma.setting.upsert({
    where: { key: 'cabinet.address' },
    update: {},
    create: { key: 'cabinet.address', value: 'Place Menelik, Djibouti-Ville', category: 'general', isPublic: true },
  });
  await prisma.setting.upsert({
    where: { key: 'cabinet.phone' },
    update: {},
    create: { key: 'cabinet.phone', value: '+253 21 35 XX XX', category: 'general', isPublic: true },
  });
  await prisma.setting.upsert({
    where: { key: 'invoice.currency' },
    update: {},
    create: { key: 'invoice.currency', value: 'DJF', category: 'accounting', isPublic: false },
  });

  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📧 Accounts créés:');
  console.log('  Admin:    admin@cabinet-notarial-djibouti.dj / Admin2024!');
  console.log('  Notaire:  notaire@cabinet-notarial-djibouti.dj / Notaire2024!');
  console.log('  Assistant: assistant@cabinet-notarial-djibouti.dj / Assistant2024!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
