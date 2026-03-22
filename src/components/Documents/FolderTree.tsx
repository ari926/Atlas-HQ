import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';

export interface FolderNode {
  id: string;
  name: string;
  googleDriveFolderId: string;
  children: FolderNode[];
}

interface Props {
  folders: FolderNode[];
  currentFolderId: string;
  onSelect: (driveFolderId: string, name: string) => void;
}

export default function FolderTree({ folders, currentFolderId, onSelect }: Props) {
  return (
    <div className="folder-tree">
      {folders.map(folder => (
        <FolderItem
          key={folder.id}
          folder={folder}
          currentFolderId={currentFolderId}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  );
}

function FolderItem({
  folder,
  currentFolderId,
  onSelect,
  depth,
}: {
  folder: FolderNode;
  currentFolderId: string;
  onSelect: (driveFolderId: string, name: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isActive = folder.googleDriveFolderId === currentFolderId;
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <div
        className={`folder-tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
        onClick={() => {
          onSelect(folder.googleDriveFolderId, folder.name);
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <span style={{ width: 14 }} />
        )}
        {isActive ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span className="folder-tree-name">{folder.name}</span>
      </div>
      {hasChildren && expanded && (
        <div className="folder-tree-children">
          {folder.children.map(child => (
            <FolderItem
              key={child.id}
              folder={child}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
