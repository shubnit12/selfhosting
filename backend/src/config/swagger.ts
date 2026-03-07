import swaggerJsdoc from "swagger-jsdoc";
import { SERVER_CONFIG } from "./constants";
import { schemas } from '../docs/swagger/schemas';
import { authPaths } from '../docs/swagger/auth.swagger';
import { filePaths } from '../docs/swagger/files.swagger';
import { folderPaths } from '../docs/swagger/folders.swagger'; 
import { sharePaths } from '../docs/swagger/share.swagger';
import { userPaths } from "../docs/swagger/users.swagger";
import { publicFolderPaths } from '../docs/swagger/publicFolders.swagger';


const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Self Hosted backend apis',
            version: '1.0.0.',
            description: 'Self-hosted file storage and sharing server API documentation',
            contact: {
                name: 'Shubnit Honey',
                email: 'shubnit99@gmail.com'
            }
        },
        servers: [
            {
                url: `http://localhost:${SERVER_CONFIG.PORT}/api/v1`,
                description: 'Development server'
            },
            {
                url: 'https://selfhost.shubnit.com/api/v1',
                description: 'Production server'
            }
        ],
        components:{
            securitySchemes:{
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token'
                }
            },
            schemas: schemas
        },
        paths:{
            ...authPaths,
            ...filePaths,
            ...folderPaths,
            ...sharePaths,
            ...userPaths,
            ...publicFolderPaths
        },
        tags: [
            {
                name: 'Authentication',
                description: 'User authentication and authorization endpoints'
            },
            {
                name: 'Files',  
                description: 'File upload, management, and deduplication endpoints'
            },
            { 
                name: 'Folders',  
                description: 'Folder management and organization endpoints'
            },
            { 
                name: 'Share Links',
                description: 'Public file sharing with password protection, expiration, and download limits'
            },
    {
        name: 'Users',
        description: 'User management endpoints (Admin only)'
    },
    {
    name: 'Public Folders',
    description: 'Publicly accessible folders (no authentication required)'
}
            
        ]
    },
    apis: [], // Path to route files with JSDoc comments

}
export const swaggerSpec = swaggerJsdoc(options);
