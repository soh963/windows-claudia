// Demo data generators for dashboard components
import type { RiskItem, DocumentationStatus as DocStatus } from '@/lib/api';

// Mock risk data generator
export const generateMockRisks = (): RiskItem[] => {
  const categories = ['security', 'performance', 'reliability', 'technical', 'data', 'infrastructure'];
  const severities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['open', 'acknowledged', 'mitigating', 'resolved'];
  
  const riskTemplates = [
    {
      category: 'security',
      title: 'SQL Injection Vulnerability',
      description: 'User input not properly sanitized in authentication queries',
      mitigation: 'Implement parameterized queries and input validation'
    },
    {
      category: 'performance',
      title: 'Database Query Performance',
      description: 'Slow queries causing page load delays over 3 seconds',
      mitigation: 'Add database indexes and optimize query structure'
    },
    {
      category: 'reliability',
      title: 'Single Point of Failure',
      description: 'Critical service has no backup or failover mechanism',
      mitigation: 'Implement load balancing and redundant service instances'
    },
    {
      category: 'technical',
      title: 'Legacy Code Dependencies',
      description: 'Outdated libraries with known security vulnerabilities',
      mitigation: 'Update to latest stable versions and remove unused dependencies'
    },
    {
      category: 'data',
      title: 'Data Backup Strategy',
      description: 'Inconsistent backup procedures may lead to data loss',
      mitigation: 'Implement automated daily backups with verification'
    },
    {
      category: 'infrastructure',
      title: 'Container Security',
      description: 'Docker containers running with elevated privileges',
      mitigation: 'Apply principle of least privilege and security scanning'
    }
  ];

  return riskTemplates.map((template, index) => ({
    id: index + 1,
    project_id: 'demo-project',
    category: template.category,
    severity: severities[Math.floor(Math.random() * severities.length)],
    title: template.title,
    description: template.description,
    mitigation: template.mitigation,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    impact_score: Math.floor(Math.random() * 100) + 1,
    probability: Math.random(),
    detected_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 30 * 24 * 60 * 60), // Random date within last 30 days
    resolved_at: Math.random() > 0.7 ? Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 7 * 24 * 60 * 60) : undefined,
    file_paths: JSON.stringify([
      `src/${template.category}/${template.title.toLowerCase().replace(/\s+/g, '_')}.ts`,
      `tests/${template.category}_test.ts`
    ])
  }));
};

// Mock documentation data generator
export const generateMockDocumentation = (): DocStatus[] => {
  const docTypes = ['readme', 'api', 'user_guide', 'developer', 'deployment', 'changelog'];
  
  const docTemplates = [
    {
      doc_type: 'readme',
      totalSections: 8,
      completedSections: 7,
      qualityScore: 85,
      missingSections: ['Contributing Guidelines']
    },
    {
      doc_type: 'api',
      totalSections: 12,
      completedSections: 9,
      qualityScore: 78,
      missingSections: ['Error Codes', 'Rate Limiting', 'Webhooks']
    },
    {
      doc_type: 'user_guide',
      totalSections: 15,
      completedSections: 6,
      qualityScore: 62,
      missingSections: ['Getting Started', 'Advanced Features', 'Troubleshooting', 'FAQ', 'Examples', 'Best Practices', 'Security', 'Performance', 'Integration']
    },
    {
      doc_type: 'developer',
      totalSections: 10,
      completedSections: 8,
      qualityScore: 91,
      missingSections: ['Testing Guidelines', 'Deployment Process']
    },
    {
      doc_type: 'deployment',
      totalSections: 6,
      completedSections: 4,
      qualityScore: 73,
      missingSections: ['Monitoring Setup', 'Rollback Procedures']
    },
    {
      doc_type: 'changelog',
      totalSections: 4,
      completedSections: 4,
      qualityScore: 95,
      missingSections: []
    }
  ];

  return docTemplates.map((template, index) => ({
    id: index + 1,
    project_id: 'demo-project',
    doc_type: template.doc_type,
    completion_percentage: (template.completedSections / template.totalSections) * 100,
    total_sections: template.totalSections,
    completed_sections: template.completedSections,
    missing_sections: JSON.stringify(template.missingSections),
    file_paths: JSON.stringify([
      `docs/${template.doc_type}.md`,
      `docs/${template.doc_type}/index.md`
    ]),
    last_updated: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 14 * 24 * 60 * 60), // Random date within last 14 days
    quality_score: template.qualityScore
  }));
};

// Helper function to get demo data
export const getDashboardDemoData = () => ({
  risks: generateMockRisks(),
  documentation: generateMockDocumentation()
});