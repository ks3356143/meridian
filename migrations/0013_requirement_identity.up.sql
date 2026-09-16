CREATE UNIQUE INDEX IF NOT EXISTS idx_software_requirements_active_name
    ON software_requirements (source_version_id, name)
    WHERE status IN ('candidate', 'official');

CREATE UNIQUE INDEX IF NOT EXISTS idx_software_requirements_identifier
    ON software_requirements (source_version_id, external_identifier)
    WHERE external_identifier <> '';
