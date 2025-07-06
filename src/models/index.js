// Central export file for all models
export { User } from './User.js';
export { Organization } from './Organization.js';
export { Document } from './Document.js';
export { Activity } from './Activity.js';
export { Folder } from './Folder.js';
export { Comment } from './Comment.js';

// Model initialization function
export const initializeModels = async () => {
  // Import all models to ensure they are registered with Mongoose
  await Promise.all([
    import('./User.js'),
    import('./Organization.js'),
    import('./Document.js'),
    import('./Activity.js'),
    import('./Folder.js'),
    import('./Comment.js')
  ]);
  
  console.log('All models initialized successfully');
};
