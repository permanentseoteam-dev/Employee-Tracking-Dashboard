import React from 'react';
import { ProjectWorkspace } from '../../components/projects/ProjectWorkspace';
import { useAuth } from '../../context/AuthContext';

export const ManagerTasksPage: React.FC = () => {
  const { user } = useAuth();
  return <ProjectWorkspace role="manager" managerId={user?.id} />;
};

export default ManagerTasksPage;
