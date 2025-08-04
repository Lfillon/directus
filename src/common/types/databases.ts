export enum DgeTables {
    TRACKING_TABLES="dge_tracking_tables",
    EDITION="dge_edition",
    EDITION_CONTENT="dge_edition_content",
    MAINTAINER_ENTITY="dge_maintainer_entity"
}

export interface DgeEdition {
    id : number,
    title: string,
    subtitle: string,
    description: string,
    release_date: string,
    status: DgeEditionStatus,
    maintainer_id: number,
    parent_id: number,
    childs_id: number[],
    content: number[],
}

export enum DgeEditionStatus {
    DRAFT= 'draft',
    DESIGN='design',
    PUBLISH='published',
    ARCHIVED='archived',
}

export interface DgeEditionContent {
    id: number,
    collection_source: string,
    origin_data: JSON,
    origin_data_column_id: string,
    published_data: JSON,
    dge_edition: number,
    status: DgeEditionContentStatus
}

export enum DgeEditionContentStatus {
    DESIGN='design',
    PUBLISH='published',
}

export enum DgeTrackingTablesTypes {
    KERNEL = "kernel",
    TRANSLATIONS = "translation",
    PROPERTY = "property",
    EXTENSION = "extension"
}

export interface DgeTrackingTables {
    id: number,
    trackedTable: DgeTrackingTablesTypes,
    type: string,
    trackingEnabled: boolean
}