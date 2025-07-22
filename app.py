@app.route('/api/custom/team/<team_type>/<team_id>', methods=['GET'])
def get_team_customization(team_type, team_id):
    """
    Get team customization settings
    
    Args:
        team_type (str): Either 'MGA' or 'RGA'
        team_id (str): ID of the team
    
    Returns:
        JSON with team customization settings
    """
    try:
        # Query database for team customization
        # Validate the team_type
        if team_type not in ['MGA', 'RGA']:
            return jsonify({"success": False, "error": "Invalid team type"}), 400
            
        # Convert team_id to proper format if needed
        cursor = mysql.connection.cursor()
        
        # Query for team customization
        query = """
            SELECT * FROM team_custom 
            WHERE team_type = %s AND team_id = %s
        """
        cursor.execute(query, (team_type, team_id))
        result = cursor.fetchone()
        cursor.close()
        
        if not result:
            return jsonify({"success": False, "error": "Team customization not found"}), 404
            
        # Format the response
        settings = {
            "team_name": result["team_name"],
            "primary_color": result["primary_color"],
            "secondary_color": result["secondary_color"],
            "accent_color": result["accent_color"],
            "custom_font": result["custom_font"],
            "logo_url": result["logo_url"]
        }
        
        return jsonify({"success": True, "settings": settings}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
        
@app.route('/api/custom/team/<team_type>/<team_id>', methods=['POST'])
def save_team_customization(team_type, team_id):
    """
    Save team customization settings
    
    Args:
        team_type (str): Either 'MGA' or 'RGA'
        team_id (str): ID of the team
    
    Returns:
        JSON success status
    """
    try:
        # Validate the team_type
        if team_type not in ['MGA', 'RGA']:
            return jsonify({"success": False, "error": "Invalid team type"}), 400
            
        # Get request data
        data = request.json
        
        # Required fields
        team_name = data.get('team_name', 'Arias Organization')
        primary_color = data.get('primary_color')
        secondary_color = data.get('secondary_color')
        accent_color = data.get('accent_color')
        custom_font = data.get('custom_font')
        
        cursor = mysql.connection.cursor()
        
        # Check if team customization already exists
        check_query = """
            SELECT id FROM team_custom 
            WHERE team_type = %s AND team_id = %s
        """
        cursor.execute(check_query, (team_type, team_id))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing record
            update_query = """
                UPDATE team_custom 
                SET team_name = %s, primary_color = %s, secondary_color = %s, 
                    accent_color = %s, custom_font = %s
                WHERE team_type = %s AND team_id = %s
            """
            cursor.execute(update_query, (
                team_name, primary_color, secondary_color, 
                accent_color, custom_font, team_type, team_id
            ))
        else:
            # Insert new record
            insert_query = """
                INSERT INTO team_custom 
                (team_type, team_id, team_name, primary_color, secondary_color, accent_color, custom_font)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(insert_query, (
                team_type, team_id, team_name, primary_color, 
                secondary_color, accent_color, custom_font
            ))
            
        mysql.connection.commit()
        cursor.close()
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500 