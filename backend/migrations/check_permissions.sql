-- Check what permissions exist for each SGA

-- Show all SGAs
SELECT 'All SGAs:' as info;
SELECT id, rept_name, display_name FROM sgas;

-- Show all permissions for ARIAS ORGANIZATION (id=1)
SELECT '\nARIAS ORGANIZATION Permissions:' as info;
SELECT spp.id, spp.sga_id, spp.page_key, s.rept_name
FROM sga_page_permissions spp
JOIN sgas s ON spp.sga_id = s.id
WHERE spp.sga_id = 1
ORDER BY spp.page_key;

-- Show all permissions for SURACE-SMITH-PARTNERS (id=2)
SELECT '\nSURACE-SMITH-PARTNERS Permissions:' as info;
SELECT spp.id, spp.sga_id, spp.page_key, s.rept_name
FROM sga_page_permissions spp
JOIN sgas s ON spp.sga_id = s.id
WHERE spp.sga_id = 2
ORDER BY spp.page_key;

-- Count total permissions per SGA
SELECT '\nPermission counts per SGA:' as info;
SELECT 
  s.id,
  s.rept_name,
  COUNT(spp.id) as permission_count
FROM sgas s
LEFT JOIN sga_page_permissions spp ON s.id = spp.sga_id
GROUP BY s.id, s.rept_name
ORDER BY s.id;

