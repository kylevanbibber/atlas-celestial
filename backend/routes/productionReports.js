const express = require("express");
const router = express.Router();
const { pool, query } = require("../db");
const verifyToken = require("../middleware/verifyToken");

// Apply auth middleware to all routes
router.use(verifyToken);

// Helper function to get user ID with proper fallback
const getUserId = async (req) => {
    if (req.user && req.user.userId) {
        return req.user.userId;
    }
    
    // For development - find any existing user or use NULL
    try {
        const existingUser = await query("SELECT id FROM activeusers LIMIT 1");
        return existingUser.length > 0 ? existingUser[0].id : null;
    } catch (error) {
        console.warn("Could not determine user ID, using NULL");
        return null;
    }
};

// ==================== CATEGORIES ROUTES ====================

// GET /api/production-reports/categories - Get all categories
router.get("/categories", async (req, res) => {
    try {
        const categories = await query(`
            SELECT id, name, description, icon, color, sort_order, is_active,
                   created_at, updated_at
            FROM file_categories 
            WHERE is_active = TRUE 
            ORDER BY sort_order ASC, name ASC
        `);
        
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ success: false, message: "Failed to fetch categories" });
    }
});

// GET /api/production-reports/categories/all - Get all categories (including inactive for admin)
router.get("/categories/all", async (req, res) => {
    try {
        const categories = await query(`
            SELECT id, name, description, icon, color, sort_order, is_active,
                   created_at, updated_at,
                   (SELECT COUNT(*) FROM onedrive_reports WHERE category_id = file_categories.id) as report_count
            FROM file_categories 
            ORDER BY sort_order ASC, name ASC
        `);
        
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error("Error fetching all categories:", error);
        res.status(500).json({ success: false, message: "Failed to fetch categories" });
    }
});

// POST /api/production-reports/categories - Create new category
router.post("/categories", async (req, res) => {
    const { name, description, icon, color, sort_order } = req.body;
    
    const userId = await getUserId(req);

    if (!name) {
        return res.status(400).json({ success: false, message: "Category name is required" });
    }

    try {
        const result = await query(`
            INSERT INTO file_categories (name, description, icon, color, sort_order, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [name, description, icon, color, sort_order || 0, userId, userId]);

        const newCategory = await query(`
            SELECT * FROM file_categories WHERE id = ?
        `, [result.insertId]);

        res.json({ success: true, data: newCategory[0] });
    } catch (error) {
        console.error("Error creating category:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: "Category name already exists" });
        } else {
            res.status(500).json({ success: false, message: "Failed to create category" });
        }
    }
});

// PUT /api/production-reports/categories/:id - Update category
router.put("/categories/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, icon, color, sort_order, is_active } = req.body;
    const userId = await getUserId(req);

    try {
        await query(`
            UPDATE file_categories 
            SET name = ?, description = ?, icon = ?, color = ?, sort_order = ?, 
                is_active = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [name, description, icon, color, sort_order, is_active, userId, id]);

        const updatedCategory = await query(`
            SELECT * FROM file_categories WHERE id = ?
        `, [id]);

        res.json({ success: true, data: updatedCategory[0] });
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ success: false, message: "Failed to update category" });
    }
});

// DELETE /api/production-reports/categories/:id - Delete category
router.delete("/categories/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // Check if category has reports
        const reportCount = await query(`
            SELECT COUNT(*) as count FROM onedrive_reports WHERE category_id = ?
        `, [id]);

        if (reportCount[0].count > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cannot delete category with existing reports. Move reports first." 
            });
        }

        await query("DELETE FROM file_categories WHERE id = ?", [id]);
        res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ success: false, message: "Failed to delete category" });
    }
});

// ==================== REPORTS ROUTES ====================

// GET /api/production-reports/reports - Get all reports with filters
router.get("/reports", async (req, res) => {
    const { category_id, is_hidden, include_hidden } = req.query;
    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];

        if (category_id) {
            whereClause += " AND r.category_id = ?";
            params.push(category_id);
        }

        if (include_hidden !== 'true') {
            whereClause += " AND r.is_hidden = FALSE";
        } else if (is_hidden) {
            whereClause += " AND r.is_hidden = ?";
            params.push(is_hidden === 'true');
        }

        const reports = await query(`
            SELECT r.id, r.subject, r.report_name, r.report_description, r.category_id,
                   r.frequency, r.report_type, r.component_name, r.icon_name,
                   r.onedrive_url, r.file_name, r.file_size, r.file_type, r.upload_date,
                   r.is_hidden, r.is_active, r.is_from_home_office, r.priority, r.sort_order,
                   r.tags, r.metadata, r.added_at, r.updated_at,
                   c.name as category_name, c.color as category_color, c.icon as category_icon,
                   u.lagnname as created_by_name,
                   (SELECT COUNT(*) FROM report_versions WHERE report_id = r.id) as version_count
            FROM onedrive_reports r
            LEFT JOIN file_categories c ON r.category_id = c.id
            LEFT JOIN activeusers u ON r.created_by = u.id
            ${whereClause}
            ORDER BY r.sort_order ASC, r.priority DESC, r.upload_date DESC, r.added_at DESC
        `, params);

        // Get versions for each report
        const reportsWithVersions = await Promise.all(reports.map(async (report) => {
            const versions = await query(`
                SELECT v.*, u.lagnname as created_by_name
                FROM report_versions v
                LEFT JOIN activeusers u ON v.created_by = u.id
                WHERE v.report_id = ?
                ORDER BY v.upload_date DESC, v.created_at DESC
            `, [report.id]);

            return {
                ...report,
                versions: versions
            };
        }));

        res.json({ success: true, data: reportsWithVersions });
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ success: false, message: "Failed to fetch reports" });
    }
});

// GET /api/production-reports/reports/:id - Get single report with versions
router.get("/reports/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
        const report = await query(`
            SELECT r.*, c.name as category_name, c.color as category_color,
                   u.lagnname as created_by_name
            FROM onedrive_reports r
            LEFT JOIN file_categories c ON r.category_id = c.id
            LEFT JOIN activeusers u ON r.created_by = u.id
            WHERE r.id = ?
        `, [id]);

        if (report.length === 0) {
            return res.status(404).json({ success: false, message: "Report not found" });
        }

        const versions = await query(`
            SELECT v.*, u.lagnname as created_by_name
            FROM report_versions v
            LEFT JOIN activeusers u ON v.created_by = u.id
            WHERE v.report_id = ?
            ORDER BY v.upload_date DESC, v.created_at DESC
        `, [id]);

        res.json({ 
            success: true, 
            data: { 
                ...report[0], 
                versions: versions 
            } 
        });
    } catch (error) {
        console.error("Error fetching report:", error);
        res.status(500).json({ success: false, message: "Failed to fetch report" });
    }
});

// POST /api/production-reports/reports - Create new report
router.post("/reports", async (req, res) => {
    const {
        subject, report_name, report_description, category_id, frequency, onedrive_url,
        file_name, file_size, file_type, upload_date, is_from_home_office,
        priority, tags
    } = req.body;
    const userId = await getUserId(req);

    if (!report_name || !onedrive_url) {
        return res.status(400).json({ 
            success: false, 
            message: "Report name and OneDrive URL are required" 
        });
    }

    try {
        // Check if a report with the same name already exists
        const existingReport = await query(`
            SELECT id FROM onedrive_reports 
            WHERE report_name = ? AND category_id = ?
            ORDER BY added_at DESC 
            LIMIT 1
        `, [report_name, category_id]);

        if (existingReport.length > 0) {
            // Report with same name exists, add this as a new version
            const reportId = existingReport[0].id;
            
            // Mark previous versions as not current
            await query("UPDATE report_versions SET is_current = FALSE WHERE report_id = ?", [reportId]);

            // Add new version
            const versionResult = await query(`
                INSERT INTO report_versions (
                    report_id, version_name, file_name, onedrive_url, file_size,
                    upload_date, is_current, version_notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)
            `, [reportId, `Version ${new Date().toISOString().slice(0, 10)}`, file_name, onedrive_url, file_size, upload_date, `Auto-created from upload: ${subject || 'No notes'}`, userId]);

            // Update main report with latest version info
            await query(`
                UPDATE onedrive_reports 
                SET onedrive_url = ?, file_name = ?, file_size = ?, upload_date = ?,
                    updated_by = ?, updated_at = CURRENT_TIMESTAMP,
                    subject = COALESCE(?, subject),
                    report_description = COALESCE(?, report_description),
                    is_from_home_office = ?, priority = COALESCE(?, priority),
                    tags = COALESCE(?, tags)
                WHERE id = ?
            `, [onedrive_url, file_name, file_size, upload_date, userId, subject, report_description, is_from_home_office !== false, priority, tags ? JSON.stringify(tags) : null, reportId]);

            // Get the updated report with version info
            const updatedReport = await query(`
                SELECT r.*, c.name as category_name,
                       (SELECT COUNT(*) FROM report_versions WHERE report_id = r.id) as version_count
                FROM onedrive_reports r
                LEFT JOIN file_categories c ON r.category_id = c.id
                WHERE r.id = ?
            `, [reportId]);

            res.json({ 
                success: true, 
                data: updatedReport[0],
                message: `Added as new version to existing report "${report_name}"`
            });
        } else {
            // No existing report, create new one
            const result = await query(`
                INSERT INTO onedrive_reports (
                    subject, report_name, report_description, category_id, frequency, onedrive_url,
                    file_name, file_size, file_type, upload_date, is_from_home_office,
                    priority, tags, created_by, updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                subject, report_name, report_description, category_id, frequency || 'ad-hoc', onedrive_url,
                file_name, file_size, file_type || 'xlsx', upload_date, 
                is_from_home_office !== false, priority || 0, 
                tags ? JSON.stringify(tags) : null, userId, userId
            ]);

            const newReport = await query(`
                SELECT r.*, c.name as category_name
                FROM onedrive_reports r
                LEFT JOIN file_categories c ON r.category_id = c.id
                WHERE r.id = ?
            `, [result.insertId]);

            res.json({ 
                success: true, 
                data: newReport[0],
                message: "New report created successfully"
            });
        }
    } catch (error) {
        console.error("Error creating report:", error);
        res.status(500).json({ success: false, message: "Failed to create report" });
    }
});

// PUT /api/production-reports/reports/:id - Update report
router.put("/reports/:id", async (req, res) => {
    const { id } = req.params;
    const {
        subject, report_name, report_description, category_id, frequency, onedrive_url,
        file_name, file_size, upload_date, is_hidden, priority, tags
    } = req.body;
    const userId = await getUserId(req);

    try {
        await query(`
            UPDATE onedrive_reports 
            SET subject = ?, report_name = ?, report_description = ?, category_id = ?, frequency = ?,
                onedrive_url = ?, file_name = ?, file_size = ?, upload_date = ?,
                is_hidden = ?, priority = ?, tags = ?, updated_by = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            subject, report_name, report_description, category_id, frequency,
            onedrive_url, file_name, file_size, upload_date, is_hidden, priority,
            tags ? JSON.stringify(tags) : null, userId, id
        ]);

        const updatedReport = await query(`
            SELECT r.*, c.name as category_name
            FROM onedrive_reports r
            LEFT JOIN file_categories c ON r.category_id = c.id
            WHERE r.id = ?
        `, [id]);

        res.json({ success: true, data: updatedReport[0] });
    } catch (error) {
        console.error("Error updating report:", error);
        res.status(500).json({ success: false, message: "Failed to update report" });
    }
});

// DELETE /api/production-reports/reports/:id - Delete report
router.delete("/reports/:id", async (req, res) => {
    const { id } = req.params;

    try {
        await query("DELETE FROM onedrive_reports WHERE id = ?", [id]);
        res.json({ success: true, message: "Report deleted successfully" });
    } catch (error) {
        console.error("Error deleting report:", error);
        res.status(500).json({ success: false, message: "Failed to delete report" });
    }
});

// POST /api/production-reports/reports/:id/versions - Add new version to report
router.post("/reports/:id/versions", async (req, res) => {
    const { id } = req.params;
    const { version_name, file_name, onedrive_url, file_size, upload_date, version_notes } = req.body;
    const userId = await getUserId(req);

    try {
        // Mark previous versions as not current
        await query("UPDATE report_versions SET is_current = FALSE WHERE report_id = ?", [id]);

        // Add new version
        const result = await query(`
            INSERT INTO report_versions (
                report_id, version_name, file_name, onedrive_url, file_size,
                upload_date, is_current, version_notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)
        `, [id, version_name, file_name, onedrive_url, file_size, upload_date, version_notes, userId]);

        // Update main report with latest version info
        await query(`
            UPDATE onedrive_reports 
            SET onedrive_url = ?, file_name = ?, file_size = ?, upload_date = ?,
                updated_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [onedrive_url, file_name, file_size, upload_date, userId, id]);

        const newVersion = await query(`
            SELECT v.*, u.lagnname as created_by_name
            FROM report_versions v
            LEFT JOIN activeusers u ON v.created_by = u.id
            WHERE v.id = ?
        `, [result.insertId]);

        res.json({ success: true, data: newVersion[0] });
    } catch (error) {
        console.error("Error adding report version:", error);
        res.status(500).json({ success: false, message: "Failed to add report version" });
    }
});

// POST /api/production-reports/reports/:id/access-log - Log report access
router.post("/reports/:id/access-log", async (req, res) => {
    const { id } = req.params;
    const { access_type } = req.body; // 'view' or 'download'
    const userId = await getUserId(req);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    try {
        await query(`
            INSERT INTO report_access_logs (report_id, user_id, access_type, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        `, [id, userId, access_type, ipAddress, userAgent]);

        res.json({ success: true, message: "Access logged" });
    } catch (error) {
        console.error("Error logging access:", error);
        res.status(500).json({ success: false, message: "Failed to log access" });
    }
});

// GET /api/production-reports/test-same-name - Test endpoint for same name reports (development only)
router.get("/test-same-name", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, message: "Test endpoint not available in production" });
    }
    
    try {
        const { report_name = "Test Weekly Report", category_id = 1 } = req.query;
        
        // Create a test report upload to demonstrate version functionality
        const testData = {
            subject: `Test Email Subject - ${new Date().toISOString()}`,
            report_name: report_name,
            report_description: "This is a test report to demonstrate version history",
            category_id: parseInt(category_id),
            onedrive_url: `https://example.sharepoint.com/test-${Date.now()}.xlsx`,
            file_name: `${report_name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            file_size: `${Math.floor(Math.random() * 900 + 100)} KB`,
            file_type: 'xlsx',
            upload_date: new Date().toISOString().slice(0, 10),
            is_from_home_office: true,
            priority: Math.floor(Math.random() * 5),
            tags: JSON.stringify(['test', 'sample'])
        };
        
        // Simulate the same logic as the POST endpoint
        const existingReport = await query(`
            SELECT id FROM onedrive_reports 
            WHERE report_name = ? AND category_id = ?
            ORDER BY added_at DESC 
            LIMIT 1
        `, [testData.report_name, testData.category_id]);
        
        let result;
        if (existingReport.length > 0) {
            result = { 
                type: 'version_added', 
                report_id: existingReport[0].id,
                message: `Would add as new version to existing report "${testData.report_name}"`
            };
        } else {
            result = { 
                type: 'new_report',
                message: `Would create new report "${testData.report_name}"`
            };
        }
        
        res.json({ 
            success: true, 
            test_data: testData,
            result: result
        });
    } catch (error) {
        console.error("Error in test endpoint:", error);
        res.status(500).json({ success: false, message: "Test failed", error: error.message });
    }
});

module.exports = router; 