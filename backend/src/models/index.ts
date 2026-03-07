import User from './User'
import Folder from './Folder'
import File from './File'
import FileReference from './FileReference';
import SharedLink from './SharedLink';
import ActivityLog from './ActivityLog';


// User has many Folders
User.hasMany(Folder,{
    foreignKey: 'user_id',
    as: 'folders'
})
// Usage:
// const user = await User.findOne({ include: ['folders'] });
// console.log(user.folders); // Array of all user's folders


// Folder belongs to User
Folder.belongsTo(User,{
    foreignKey: 'user_id',
    as: 'owner'
})
//Usage: 
// const folder = await Folder.findOne({ include: ['owner'] });
// console.log(folder.owner.username); // Get folder owner's username

// Folder has many Folders (self-referencing for subfolders)
Folder.hasMany(Folder,{
    foreignKey: 'parent_folder_id',
    as: 'subfolders'
})
//Usage:
// const folder = await Folder.findOne({ include: ['subfolders'] });
// console.log(folder.subfolders); // Array of subfolders inside this folder

// Folder belongs to Folder (parent folder)
Folder.belongsTo(Folder, {
  foreignKey: 'parent_folder_id',
  as: 'parentFolder'
});
//Usage:
// const subfolder = await Folder.findOne({ include: ['parentFolder'] });
// console.log(subfolder.parentFolder.name); // Get parent folder name

// User has many Files
User.hasMany(File,{
    foreignKey: 'user_id',
    as: 'files'
});
// Get all files owned by a user
// const user = await User.findOne({ include: ['files'] });
// console.log(user.files); // Array of all user's files


// File belongs to User (owner)
File.belongsTo(User, {
    foreignKey:'user_id',
    as: 'owner'
});
// Get file with owner information
// const file = await File.findOne({ include: ['owner'] });
// console.log(file.owner.username); // Who owns this file?

// Folder has many Files
Folder.hasMany(File, {
    foreignKey: 'folder_id',
    as: 'files'
});
// Get all files in a folder
// const folder = await Folder.findOne({ include: ['files'] });
// console.log(folder.files); // Array of files in this folder

// File belongs to Folder (location)
File.belongsTo(Folder, {
    foreignKey: 'folder_id',
    as: 'folder'
})
// Get file with its folder location
// const file = await File.findOne({ include: ['folder'] });
// console.log(file.folder?.name); // Which folder contains this file?
// Note: folder can be null (file in root)

// File has many Files (versions)
File.hasMany(File, {
    foreignKey: 'parent_file_id',
    as: 'versions'
});
// Get all versions of a file
// const originalFile = await File.findOne({ 
    // where: { id: 'file-id' },
    // include: ['versions']
// });
// console.log(originalFile.versions); // Array of newer versions
 
// File belongs to File (parent version)
File.belongsTo(File, {
    foreignKey: 'parent_file_id',
    as: 'parentVersion'
});
// const newerVersion = await File.findOne({ 
    // where: { id: 'version-id' },
    // include: ['parentVersion']
// });
// console.log(newerVersion.parentVersion); // The previous version

// FileReference has many Files (one physical file → many user files)
FileReference.hasMany(File, {
    foreignKey: 'file_hash',
    sourceKey: 'file_hash',  // ← Link using file_hash, not id!
    as: 'files'
});
 
// File belongs to FileReference
File.belongsTo(FileReference, {
    foreignKey: 'file_hash',
    targetKey: 'file_hash',  // ← Link using file_hash, not id!
    as: 'fileReference'
});

// File has many SharedLinks
File.hasMany(SharedLink, {
    foreignKey: 'file_id',
    as: 'sharedLinks'
});

// SharedLink belongs to File
SharedLink.belongsTo(File, {
    foreignKey: 'file_id',
    as: 'file'
});

// User has many SharedLinks (created by them)
User.hasMany(SharedLink, {
    foreignKey: 'created_by_user_id',
    as: 'sharedLinks'
});
 
// SharedLink belongs to User (creator)
SharedLink.belongsTo(User, {
    foreignKey: 'created_by_user_id',
    as: 'creator'
});
 
// User has many ActivityLogs
User.hasMany(ActivityLog, {
    foreignKey: 'user_id',
    as: 'activityLogs'
});
 
// ActivityLog belongs to User
ActivityLog.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

// File has many ActivityLogs
File.hasMany(ActivityLog, {
    foreignKey: 'file_id',
    as: 'activityLogs'
});
 
// ActivityLog belongs to File
ActivityLog.belongsTo(File, {
    foreignKey: 'file_id',
    as: 'file'
});

// Folder has many ActivityLogs
Folder.hasMany(ActivityLog, {
    foreignKey: 'folder_id',
    as: 'activityLogs'
});
 
// ActivityLog belongs to Folder
ActivityLog.belongsTo(Folder, {
    foreignKey: 'folder_id',
    as: 'folder'
});

// SharedLink has many ActivityLogs
SharedLink.hasMany(ActivityLog, {
    foreignKey: 'shared_link_id',
    as: 'activityLogs'
})
// ActivityLog belongs to SharedLink
ActivityLog.belongsTo(SharedLink, {
    foreignKey: 'shared_link_id',
    as: 'sharedLink'
});
export { User, Folder, File, FileReference, SharedLink, ActivityLog };
export default { User, Folder, File, FileReference, SharedLink, ActivityLog };

// Without these Associations
// Manual, multiple queries
// const user = await User.findByPk('user-id');
// const folders = await Folder.findAll({ where: { user_id: user.id } });
// const subfolders = await Folder.findAll({ where: { parent_folder_id: folders[0].id } });
// Tedious, error-prone

//With these Associations
// Clean, single query with eager loading
// const user = await User.findByPk('user-id', {
//   include: [{
//     model: Folder,
//     as: 'folders',
//     include: ['subfolders']  // Nested loading!
//   }]
// });
// Clean, efficient