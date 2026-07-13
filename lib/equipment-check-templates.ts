/**
 * Standard pre-flight / daily safety checks for common site equipment.
 * Each template is a list of items that can be marked pass / fail / n/a.
 */

export interface TemplateItem { id: string; label: string }
export interface CheckTemplate { type: string; title: string; items: TemplateItem[] }

export const EQUIPMENT_CHECK_TEMPLATES: Record<string, CheckTemplate> = {
  scissor_lift: {
    type: 'scissor_lift',
    title: 'Scissor lift daily check',
    items: [
      { id: 'sl-1', label: 'Operator trained and authorised for this machine' },
      { id: 'sl-2', label: 'Manufacturer manual and emergency lowering procedure available' },
      { id: 'sl-3', label: 'Outriggers / stabilisers deployed and tyres correct pressure' },
      { id: 'sl-4', label: 'No visible hydraulic leaks, hoses or cylinders damaged' },
      { id: 'sl-5', label: 'Guard rails, gates and toe boards in place and secure' },
      { id: 'sl-6', label: 'Platform controls, emergency stop and tilt alarm tested' },
      { id: 'sl-7', label: 'Ground base sound, level and clear of voids / obstructions' },
      { id: 'sl-8', label: 'Overhead hazards (power lines, structures) identified and avoided' },
      { id: 'sl-9', label: 'PPE inspected: harness (if required), hard hat, hi-vis, boots' },
      { id: 'sl-10', label: 'Weather conditions acceptable (wind, rain, ice)' },
      { id: 'sl-11', label: 'Machine returned to safe parked state and key removed' },
    ],
  },
  cherry_picker: {
    type: 'cherry_picker',
    title: 'MEWP / cherry picker pre-use check',
    items: [
      { id: 'cp-1', label: 'Operator holds current IPAF / MEWP competency for this category' },
      { id: 'cp-2', label: 'Latest 6-month thorough examination certificate in date and on file' },
      { id: 'cp-3', label: 'Outriggers fully deployed on firm ground with spreader plates' },
      { id: 'cp-4', label: 'Boom, basket, turntable and wear pads visually inspected' },
      { id: 'cp-5', label: 'Hydraulic oil level checked; no leaks or weeping joints' },
      { id: 'cp-6', label: 'Emergency lowering, ground controls and basket controls tested' },
      { id: 'cp-7', label: 'Horn, lights, travel alarms and function-enable switch working' },
      { id: 'cp-8', label: 'Overhead power lines and exclusion zones identified' },
      { id: 'cp-9', label: 'Correct PPE: full-body harness with short lanyard attached to anchor' },
      { id: 'cp-10', label: 'Rescue plan briefed and ground marshal present' },
      { id: 'cp-11', label: 'Weather/wind speed within manufacturer limits' },
    ],
  },
  telehandler: {
    type: 'telehandler',
    title: 'Telehandler daily check',
    items: [
      { id: 'th-1', label: 'Operator trained, authorised and medical fit to operate' },
      { id: 'th-2', label: 'Load chart and 12-month thorough examination in date' },
      { id: 'th-3', label: 'Tyres, wheel nuts and steering inspected' },
      { id: 'th-4', label: 'Fluid levels checked: engine oil, coolant, hydraulic oil, brake fluid' },
      { id: 'th-5', label: 'No leaks from hydraulics, engine or transmission' },
      { id: 'th-6', label: 'Brakes, handbrake and inching pedal tested before use' },
      { id: 'th-7', label: 'Boom, forks, carriage and attachment pins secure' },
      { id: 'th-8', label: 'Lights, indicators, beacon, horn and reversing alarm working' },
      { id: 'th-9', label: 'Load correctly slung / palletised within rated capacity' },
      { id: 'th-10', label: 'Banksman / spotter used where visibility is restricted' },
      { id: 'th-11', label: 'Travelling with load low and site speed limits observed' },
    ],
  },
  harness: {
    type: 'harness',
    title: 'Harness and lanyard inspection',
    items: [
      { id: 'hs-1', label: 'Harness has current in-date inspection tag (within last 6 months)' },
      { id: 'hs-2', label: 'No cuts, fraying, burns, chemical damage or excessive wear' },
      { id: 'hs-3', label: 'Stitching intact; no pulled or broken stitches' },
      { id: 'hs-4', label: 'Buckles, D-rings and adjusters move freely and lock correctly' },
      { id: 'hs-5', label: 'Lanyard length appropriate and energy absorber not deployed' },
      { id: 'hs-6', label: 'Karabiners / hooks close and lock, no deformation' },
      { id: 'hs-7', label: 'Correct harness fitted to wearer and adjusted before work at height' },
      { id: 'hs-8', label: 'User trained in harness use, inspection limits and rescue' },
    ],
  },
  fall_arrest: {
    type: 'fall_arrest',
    title: 'Fall-arrest system check',
    items: [
      { id: 'fa-1', label: 'System selected is suitable for the task and edge protection' },
      { id: 'fa-2', label: 'Anchorage point certified / tested and identified' },
      { id: 'fa-3', label: 'Cable, rail, rope and connectors free from damage / corrosion' },
      { id: 'fa-4', label: 'Shock absorber, tensioner and inertia reel function checked' },
      { id: 'fa-5', label: 'Clearance below and swing-fall distance calculated' },
      { id: 'fa-6', label: 'Rescue equipment available and rescue plan briefed' },
      { id: 'fa-7', label: 'Number of users on system does not exceed design limit' },
      { id: 'fa-8', label: 'Competent person sign-off recorded' },
    ],
  },
  ladder: {
    type: 'ladder',
    title: 'Ladder pre-use check',
    items: [
      { id: 'ld-1', label: 'Ladder class correct for site / industrial use' },
      { id: 'ld-2', label: 'No bent stiles, missing rungs, cracks or rot' },
      { id: 'ld-3', label: 'Feet intact and anti-slip; extension ladders have working locks' },
      { id: 'ld-4', label: 'Ladder secured at top / footed by second person' },
      { id: 'ld-5', label: 'Set at correct 1-in-4 angle and extends 1 m above landing' },
      { id: 'ld-6', label: 'Used for light work only; tools secured by lanyard' },
    ],
  },
}

export const EQUIPMENT_TYPES = [
  { value: 'scissor_lift', label: 'Scissor lift', color: '#2563eb' },
  { value: 'cherry_picker', label: 'Cherry picker / MEWP', color: '#f59e0b' },
  { value: 'telehandler', label: 'Telehandler', color: '#8b5cf6' },
  { value: 'harness', label: 'Harness', color: '#10b981' },
  { value: 'fall_arrest', label: 'Fall arrest', color: '#ef4444' },
  { value: 'ladder', label: 'Ladder', color: '#06b6d4' },
  { value: 'other', label: 'Other', color: '#52749a' },
]
