#!/bin/bash
# Add breadcrumbs to all CortexBuild modules
# Usage: ./add-breadcrumbs-to-all-modules.sh

cd /Users/adrianstanca/cortexbuild-ultimate/src/components/modules

# Module name mapping (file name -> module identifier)
declare -A MODULE_NAMES=(
  ["Accounting.tsx"]="accounting"
  ["AIAssistant.tsx"]="ai-assistant"
  ["AIVision.tsx"]="ai-vision"
  ["Analytics.tsx"]="analytics"
  ["AuditLog.tsx"]="audit-log"
  ["BIMViewer.tsx"]="bim-viewer"
  ["Calendar.tsx"]="calendar"
  ["Certifications.tsx"]="certifications"
  ["ChangeOrders.tsx"]="change-orders"
  ["CIS.tsx"]="cis"
  ["CostManagement.tsx"]="cost-management"
  ["CRM.tsx"]="crm"
  ["DailyReports.tsx"]="daily-reports"
  ["Defects.tsx"]="defects"
  ["DevSandbox.tsx"]="dev-sandbox"
  ["Documents.tsx"]="documents"
  ["Drawings.tsx"]="drawings"
  ["EmailHistory.tsx"]="email-history"
  ["ExecutiveReports.tsx"]="executive-reports"
  ["FieldView.tsx"]="field-view"
  ["FinancialReports.tsx"]="financial-reports"
  ["Insights.tsx"]="insights"
  ["Inspections.tsx"]="inspections"
  ["Invoicing.tsx"]="invoicing"
  ["Lettings.tsx"]="lettings"
  ["Marketplace.tsx"]="marketplace"
  ["Materials.tsx"]="materials"
  ["Measuring.tsx"]="measuring"
  ["Meetings.tsx"]="meetings"
  ["MyDesktop.tsx"]="my-desktop"
  ["PermissionsManager.tsx"]="permissions"
  ["PlantEquipment.tsx"]="plant"
  ["PredictiveAnalytics.tsx"]="predictive-analytics"
  ["Prequalification.tsx"]="prequalification"
  ["Procurement.tsx"]="procurement"
  ["Projects.tsx"]="projects"
  ["PunchList.tsx"]="punch-list"
  ["RAMS.tsx"]="rams"
  ["ReportTemplates.tsx"]="report-templates"
  ["RFIs.tsx"]="rfis"
  ["RiskRegister.tsx"]="risk-register"
  ["Safety.tsx"]="safety"
  ["Settings.tsx"]="settings"
  ["Signage.tsx"]="signage"
  ["SiteOperations.tsx"]="site-ops"
  ["Specifications.tsx"]="specifications"
  ["Subcontractors.tsx"]="subcontractors"
  ["SubmittalManagement.tsx"]="submittal-management"
  ["Sustainability.tsx"]="sustainability"
  ["Teams.tsx"]="teams"
  ["TempWorks.tsx"]="temp-works"
  ["Tenders.tsx"]="tenders"
  ["Timesheets.tsx"]="timesheets"
  ["Training.tsx"]="training"
  ["Valuations.tsx"]="valuations"
  ["Variations.tsx"]="variations"
  ["WasteManagement.tsx"]="waste-management"
)

echo "🔧 Adding breadcrumbs to all CortexBuild modules..."
echo ""

added=0
skipped=0
errors=0

for file in "${!MODULE_NAMES[@]}"; do
  module_name="${MODULE_NAMES[$file]}"
  
  if [ ! -f "$file" ]; then
    echo "⚠️  File not found: $file"
    ((errors++))
    continue
  fi
  
  # Check if already has breadcrumbs
  if grep -q "ModuleBreadcrumbs" "$file"; then
    echo "⏭️  Already has breadcrumbs: $file"
    ((skipped++))
    continue
  fi
  
  # Add import after first import line
  if ! grep -q "import.*Breadcrumbs" "$file"; then
    sed -i "/^import.*from.*ui/i import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';" "$file" 2>/dev/null
    if [ $? -ne 0 ]; then
      # Fallback: add after first import
      sed -i "1a import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';" "$file" 2>/dev/null
    fi
  fi
  
  # Add breadcrumbs component after first return statement in main component
  # Look for return ( followed by <div and add breadcrumbs after
  if grep -q "return (" "$file"; then
    # Find the line number of first return statement in main export function
    line_num=$(grep -n "return (" "$file" | head -1 | cut -d: -f1)
    if [ -n "$line_num" ]; then
      # Add breadcrumbs after the return line
      sed -i "${line_num}a\\      {/* Breadcrumbs */}\\n      <ModuleBreadcrumbs currentModule=\"$module_name\" onNavigate={() => {}} />" "$file"
    fi
  fi
  
  echo "✅ Added breadcrumbs: $file ($module_name)"
  ((added++))
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Summary:"
echo "  ✅ Added: $added modules"
echo "  ⏭️  Skipped: $skipped modules (already had breadcrumbs)"
echo "  ⚠️  Errors: $errors modules"
echo "═══════════════════════════════════════════════════════"
