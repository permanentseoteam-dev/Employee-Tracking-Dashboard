import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectExplorer } from '../components/projects/ProjectExplorer';

export const ProjectsPage: React.FC = () => {
  const { user } = useAuth();
  return <ProjectExplorer role="employee" managerId={user?.id} />;
};

export default ProjectsPage;
