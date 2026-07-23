# Analytics Permission Model

Backend permission scoping is authoritative. Hiding a page or control in React is not a security boundary.

## Effective access matrix

| Capability | Staff | Admin | Super Admin |
|---|---:|---:|---:|
| Operational analytics | Assigned location | All authorized locations | All locations |
| Location analytics | Assigned location data | Yes | Yes |
| Lead Source analytics | Assigned location data | Yes | Yes |
| Staff Analytics page | No | Yes | Yes |
| Costs & Margin Analytics page | No | Yes | Yes |
| Financial analytics payload | Empty/zero | Yes | Yes |
| Staff ranking and health payload | Empty | Yes | Yes |
| Drill-through | Assigned location | All authorized locations | All locations |
| Global family/tour search | Assigned location | All authorized locations | All locations |
| Global staff search | No | Yes | Yes |
| Excel all-authorized export | Assigned location | All authorized locations | All locations |
| Cost-basis management | No | No | Yes |

## Enforcement points

1. `filter_queryset_by_location()` limits staff querysets to the user's assigned location.
2. `base_queryset()` applies that scope before analytics calculations.
3. `cohort_analytics()` gates financial and staff sections by role.
4. `RoleRoute` blocks restricted frontend routes.
5. Drill-through, export, and search independently reapply backend scope.
6. “All authorized data” removes entity filters but never removes role or location scope.

## Configuration rules

- Admins and super admins may view formula definitions.
- Core formulas are not editable in the UI by any role.
- Structural permission rules are changed through code review.
- A future super-admin settings page may change approved thresholds and operational settings only.
- No UI may accept executable Python, SQL, JavaScript, or arbitrary formula expressions.

## Required permission testing

Every endpoint and export must test:

- Staff cannot escape assigned-location scope.
- Combining staff and location filters uses intersection, not union.
- Staff receive no Staff Analytics or financial details.
- Admins receive analytics access without receiving super-admin cost-basis management rights.
- Direct API use enforces the same restrictions as the UI.
- All-authorized exports do not broaden access.
