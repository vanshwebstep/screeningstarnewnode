const DailyActivity = require("../../../models/admin/internal-storage/dailyActivityTrackerModel");
const Common = require("../../../models/admin/commonModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

// Controller to create a new service
exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        bd_expert_name,
        date,
        client_organization_name,
        company_size,
        spoc_name,
        spoc_designation,
        contact_number,
        email,
        is_using_any_bgv_vendor,
        vendor_name,
        is_interested_in_using_our_services,
        reason_for_not_using_our_services,
        reason_for_using_our_services,
        callback_asked_at,
        is_prospect,
        comments,
        followup_date,
        followup_comments,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    const requiredFields = {
        admin_id: "Admin ID",
        _token: "Token",
    };

    for (let field in requiredFields) {
        if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === "")) {
            missingFields.push(requiredFields[field]);
        }
    }

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }

        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }
            DailyActivity.create(
                bd_expert_name,
                date,
                client_organization_name,
                company_size,
                spoc_name,
                spoc_designation,
                contact_number,
                email,
                is_using_any_bgv_vendor,
                vendor_name,
                is_interested_in_using_our_services,
                reason_for_not_using_our_services,
                reason_for_using_our_services,
                callback_asked_at,
                is_prospect,
                comments,
                followup_date,
                followup_comments,
                remarks,
                (err, result) => {
                    if (err) {
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/Vendor",
                            "Create",
                            "0",
                            null,
                            err,
                            () => { }
                        );
                        console.error("Database error:", err);
                        return res.status(500).json({ status: false, message: err.message });
                    }
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Internal Storage/Vendor",
                        "Create",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                    );

                    res.json({
                        status: true,
                        message: "Vendor created successfully",
                        service: result,
                    });
                }
            );
        });
    });
};

exports.list = (req, res) => {
    const { admin_id, _token } = req.query;

    let missingFields = [];
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            DailyActivity.list((err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res
                        .status(500)
                        .json({ status: false, message: err.message, token: newToken });
                }

                res.json({
                    status: true,
                    message: "Universities fetched successfully",
                    services: result,
                    totalResults: result.length,
                    token: newToken,
                });
            });
        });
    });
};

exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        id,
        bd_expert_name,
        date,
        client_organization_name,
        company_size,
        spoc_name,
        spoc_designation,
        contact_number,
        email,
        is_using_any_bgv_vendor,
        vendor_name,
        is_interested_in_using_our_services,
        reason_for_not_using_our_services,
        reason_for_using_our_services,
        callback_asked_at,
        is_prospect,
        comments,
        followup_date,
        followup_comments,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    const requiredFields = {
        id: "Vendor ID",
        admin_id: "Admin ID",
        _token: "Token",
    };

    for (let field in requiredFields) {
        if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === "")) {
            missingFields.push(requiredFields[field]);
        }
    }

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            DailyActivity.getById(id, (err, currentDailyActivity) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                const changes = {
                    old: currentDailyActivity,
                    new: {
                        bd_expert_name,
                        date,
                        client_organization_name,
                        company_size,
                        spoc_name,
                        spoc_designation,
                        contact_number,
                        email,
                        is_using_any_bgv_vendor,
                        vendor_name,
                        is_interested_in_using_our_services,
                        reason_for_not_using_our_services,
                        reason_for_using_our_services,
                        callback_asked_at,
                        is_prospect,
                        comments,
                        followup_date,
                        followup_comments,
                        remarks,
                    },
                };

                DailyActivity.update(
                    id,
                    bd_expert_name,
                    date,
                    client_organization_name,
                    company_size,
                    spoc_name,
                    spoc_designation,
                    contact_number,
                    email,
                    is_using_any_bgv_vendor,
                    vendor_name,
                    is_interested_in_using_our_services,
                    reason_for_not_using_our_services,
                    reason_for_using_our_services,
                    callback_asked_at,
                    is_prospect,
                    comments,
                    followup_date,
                    followup_comments,
                    remarks,
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            Common.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "Internal Storage/Vendor",
                                "Update",
                                "0",
                                JSON.stringify({ id, ...changes }),
                                err,
                                () => { }
                            );
                            return res
                                .status(500)
                                .json({ status: false, message: err.message, token: newToken });
                        }

                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/Vendor",
                            "Update",
                            "1",
                            JSON.stringify({ id, ...changes }),
                            null,
                            () => { }
                        );

                        return res.json({
                            status: true,
                            message: "Vendor updated successfully",
                            service: result,
                            token: newToken,
                        });
                    }
                );
            });
        });
    });
};

exports.delete = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const { id, admin_id, _token } = req.query;

    let missingFields = [];
    if (!id || id === "") missingFields.push("Vendor ID");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            DailyActivity.getById(id, (err, currentVendor) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                DailyActivity.delete(id, (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/Vendor",
                            "Delete",
                            "0",
                            JSON.stringify({ id, ...currentVendor }),
                            err,
                            () => { }
                        );
                        return res
                            .status(500)
                            .json({ status: false, message: err.message, token: newToken });
                    }

                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Internal Storage/Vendor",
                        "Delete",
                        "1",
                        JSON.stringify(currentVendor),
                        null,
                        () => { }
                    );

                    return res.json({
                        status: true,
                        message: "Vendor deleted successfully",
                        token: newToken,
                    });
                });
            });
        });
    });
};
