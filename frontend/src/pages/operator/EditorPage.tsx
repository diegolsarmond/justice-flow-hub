import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  fetchIntegrationApiKeys,
  generateAiText,
  getApiKeyEnvironmentLabel,
  getApiKeyProviderLabel,
  type IntegrationApiKey,
} from '@/lib/integrationApiKeys';
import { createTemplate, getTemplate, updateTemplate, exportTemplatePdf } from '@/lib/templates';
import { createSimplePdfFromHtml } from '@/lib/pdf';
import { createDocxBlobFromHtml } from '@/lib/docx';
import type {
  EditorJsonContent,
  EditorJsonNode,
  TemplatePayload,
  Template,
} from '@/types/templates';
import { defaultTemplateMetadata } from '@/types/templates';
import type { VariableMenuItem } from '@/features/document-editor/data/variable-items';
import { variableMenuTree } from '@/features/document-editor/data/variable-items';
import { InsertMenu } from '@/features/document-editor/components/InsertMenu';
import { EditorToolbar, type ToolbarAlignment, type ToolbarBlock, type ToolbarState } from '@/features/document-editor/components/EditorToolbar';
import { SidebarNavigation } from '@/features/document-editor/components/SidebarNavigation';
import { MetadataModal, type MetadataFormValues } from '@/features/document-editor/components/MetadataModal';
import { SaveButton } from '@/features/document-editor/components/SaveButton';
import { Download, FileDown, Loader2, Menu, Sparkles } from 'lucide-react';
import { fetchClientCustomAttributeTypes, type ClientCustomAttributeType } from '@/features/document-editor/api/client-custom-attributes';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function nodeToHtml(node: EditorJsonNode): string {
  if (node.type === 'text') {
    return escapeHtml(node.text ?? '');
  }

  const attrs = node.attrs
    ? Object.entries(node.attrs)
      .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
      .join(' ')
    : '';
  const children = (node.children ?? []).map(nodeToHtml).join('');
  if (['img', 'br', 'hr'].includes(node.type)) {
    return `<${node.type}${attrs ? ` ${attrs}` : ''} />`;
  }
  return `<${node.type}${attrs ? ` ${attrs}` : ''}>${children}</${node.type}>`;
}

function jsonToHtml(content: EditorJsonContent | null): string {
  if (!content) return '<p></p>';
  return content.map(nodeToHtml).join('');
}

function serializeNode(node: Node): EditorJsonNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: 'text', text: node.textContent ?? '' };
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach(attr => {
      if (attr.name === 'style' && attr.value.trim().length === 0) return;
      attrs[attr.name] = attr.value;
    });
    const children = Array.from(element.childNodes)
      .map(child => serializeNode(child))
      .filter((child): child is EditorJsonNode => child !== null);
    return {
      type: element.tagName.toLowerCase(),
      attrs,
      children,
    };
  }
  return null;
}

function htmlToJson(html: string): EditorJsonContent {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes: EditorJsonContent = [];
  Array.from(doc.body.childNodes).forEach(node => {
    const serialized = serializeNode(node);
    if (serialized) {
      nodes.push(serialized);
    }
  });
  return nodes;
}

function extractPlaceholders(html: string): string[] {
  const regex = /{{\s*([\w.]+)\s*}}/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

function formatVariableLabel(name: string, label?: string | null): string {
  if (label && label.trim().length > 0) {
    return label.trim();
  }
  return name
    .split('.')
    .map(part =>
      part
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase()),
    )
    .join(' • ');
}

function cloneVariableMenuItems(items: VariableMenuItem[]): VariableMenuItem[] {
  return items.map(item => ({
    ...item,
    children: item.children ? cloneVariableMenuItems(item.children) : undefined,
  }));
}

const slugifyFilename = (value: string): string => {
  const base = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9\s-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return base.length > 0 ? base : 'documento';
};

const fontSizeMap: Record<string, string> = {
  '1': '10px',
  '2': '12px',
  '3': '16px',
  '4': '18px',
  '5': '24px',
  '6': '32px',
  '7': '48px',
};

const initialToolbarState: ToolbarState = {
  block: 'paragraph',
  fontSize: 'default',
  align: 'left',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  orderedList: false,
  bulletList: false,
  blockquote: false,
  highlight: false,
};

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'peticao', label: 'Petição' },
  { value: 'parecer', label: 'Parecer' },
  { value: 'recurso', label: 'Recurso' },
  { value: 'notificacao', label: 'Notificação' },
  { value: 'outro', label: 'Outro' },
];

const EMPTY_CLIENT_CUSTOM_ATTRIBUTES: ClientCustomAttributeType[] = [];

export default function EditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = !id || id === 'novo';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user } = useAuth();

  const companyId = typeof user?.empresa_id === 'number' ? user.empresa_id : null;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState('');
  const [metadata, setMetadata] = useState(defaultTemplateMetadata);
  const [contentHtml, setContentHtml] = useState('<p></p>');
  const [editorJson, setEditorJson] = useState<EditorJsonContent | null>(null);
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'editor' | 'metadata' | 'placeholders'>('editor');
  const [toolbarState, setToolbarState] = useState<ToolbarState>(initialToolbarState);
  const [tagEditor, setTagEditor] = useState<{ element: HTMLElement; label: string } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiDocumentType, setAiDocumentType] = useState<string>(DOCUMENT_TYPE_OPTIONS[0]?.value ?? 'contrato');
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);
  const [isGeneratingAiContent, setIsGeneratingAiContent] = useState(false);
  const [downloadState, setDownloadState] = useState<'pdf' | 'docx' | null>(null);

  const editorSectionRef = useRef<HTMLDivElement | null>(null);
  const metadataSectionRef = useRef<HTMLDivElement | null>(null);
  const placeholdersSectionRef = useRef<HTMLDivElement | null>(null);

  const draggedNodeRef = useRef<HTMLElement | null>(null);

  const locationState = location.state as { openMetadata?: boolean } | null;

  const integrationQuery = useQuery({
    queryKey: ['integration-api-keys'],
    queryFn: fetchIntegrationApiKeys,
  });

  const clientCustomAttributeTypesQuery = useQuery({
    queryKey: ['client-custom-attribute-types'],
    queryFn: fetchClientCustomAttributeTypes,
  });

  const accessibleIntegrationKeys = useMemo(() => {
    if (!integrationQuery.data) return [] as IntegrationApiKey[];
    return integrationQuery.data.filter((integration) => {
      if (integration.global) {
        return true;
      }

      if (companyId === null) {
        return false;
      }

      return integration.empresaId === companyId;
    });
  }, [integrationQuery.data, companyId]);

  const activeAiIntegrations = useMemo(() => {
    const allowedProviders = ['gemini', 'openai'];
    return [...accessibleIntegrationKeys]
      .filter(integration => {
        const provider = typeof integration.provider === 'string'
          ? integration.provider.trim().toLowerCase()
          : '';
        return integration.active && allowedProviders.includes(provider);
      })
      .sort((a, b) => {
        if (a.environment === b.environment) {
          const labelA = getApiKeyProviderLabel(a.provider) || a.provider;
          const labelB = getApiKeyProviderLabel(b.provider) || b.provider;
          return labelA.localeCompare(labelB);
        }
        if (a.environment === 'producao') return -1;
        if (b.environment === 'producao') return 1;
        return a.environment.localeCompare(b.environment);
      });
  }, [accessibleIntegrationKeys]);

  const hasActiveAiIntegrations = activeAiIntegrations.length > 0;
  const isLoadingAiIntegrations = integrationQuery.isLoading;
  const isAiButtonDisabled = isLoadingAiIntegrations || !hasActiveAiIntegrations;

  useEffect(() => {
    if (activeAiIntegrations.length === 0) {
      if (selectedIntegrationId !== null) {
        setSelectedIntegrationId(null);
      }
      return;
    }

    const exists = activeAiIntegrations.some(integration => integration.id === selectedIntegrationId);
    if (!exists) {
      setSelectedIntegrationId(activeAiIntegrations[0].id);
    }
  }, [activeAiIntegrations, selectedIntegrationId]);

  useEffect(() => {
    if (locationState?.openMetadata) {
      setIsMetadataModalOpen(true);
    }
  }, [locationState]);

  useEffect(() => {
    setSidebarCollapsed(isMobile);
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  const templateQuery = useQuery({
    queryKey: ['template', id],
    queryFn: () => getTemplate(Number(id)),
    enabled: !isNew,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: TemplatePayload) =>
      isNew ? createTemplate(payload) : updateTemplate(Number(id), payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDirty(false);
      if (isNew) {
        navigate(`/documentos/editor/${data.id}`);
      }
    },
  });

  const decorateVariableTags = useCallback((container?: HTMLElement | null) => {
    const host = container ?? editorRef.current;
    if (!host) return;
    const tags = host.querySelectorAll<HTMLElement>('[data-variable]');
    tags.forEach(tag => {
      tag.classList.add('variable-tag');
      tag.setAttribute('contenteditable', 'false');
      tag.setAttribute('draggable', 'true');
      tag.setAttribute('tabindex', '0');
      const variable = tag.getAttribute('data-variable') ?? '';
      const label = tag.getAttribute('data-label');
      tag.textContent = formatVariableLabel(variable, label);
      tag.setAttribute('role', 'button');
      tag.setAttribute('aria-label', `Editar rótulo para ${variable}`);
    });
  }, []);

  const normalizeFontTags = useCallback(() => {
    const container = editorRef.current;
    if (!container) return;
    const fonts = container.querySelectorAll('font');
    fonts.forEach(font => {
      const size = font.getAttribute('size') ?? '3';
      const span = document.createElement('span');
      span.style.fontSize = fontSizeMap[size] ?? fontSizeMap['3'];
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  }, []);

  const updateToolbarState = useCallback(() => {
    const selection = document.getSelection();
    if (!selection || !editorRef.current) return;
    if (!editorRef.current.contains(selection.anchorNode)) return;

    const blockValue = (document.queryCommandValue('formatBlock') || 'p').toString().toLowerCase();
    const block: ToolbarBlock = blockValue === 'h1' ? 'h1' : blockValue === 'h2' ? 'h2' : blockValue === 'h3' ? 'h3' : 'paragraph';
    const fontSizeValue = document.queryCommandValue('fontSize')?.toString() ?? 'default';
    let align: ToolbarAlignment = 'left';
    if (document.queryCommandState('justifyCenter')) align = 'center';
    else if (document.queryCommandState('justifyRight')) align = 'right';
    else if (document.queryCommandState('justifyFull')) align = 'justify';

    const highlightValue = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor');
    const highlight =
      typeof highlightValue === 'string' &&
      highlightValue !== 'transparent' &&
      highlightValue !== 'rgba(0, 0, 0, 0)' &&
      highlightValue !== '';

    setToolbarState({
      block,
      fontSize: fontSizeValue || 'default',
      align,
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      orderedList: document.queryCommandState('insertOrderedList'),
      bulletList: document.queryCommandState('insertUnorderedList'),
      blockquote: blockValue === 'blockquote',
      highlight,
    });
  }, []);

  const handleContentUpdate = useCallback(() => {
    const container = editorRef.current;
    if (!container) return;
    decorateVariableTags(container);
    normalizeFontTags();
    const html = container.innerHTML;
    setContentHtml(html);
    setEditorJson(htmlToJson(html));
    setIsDirty(true);
  }, [decorateVariableTags, normalizeFontTags]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    document.execCommand('styleWithCSS', false, 'true');

    const handleInput = () => {
      handleContentUpdate();
      updateToolbarState();
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();

      const variableData = event.dataTransfer?.getData('application/x-jus-variable');

      if (variableData) {
        try {
          const item = JSON.parse(variableData);
          let range: Range | null = null;

          if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(event.clientX, event.clientY);
          } else if ((document as any).caretPositionFromPoint) {
            const pos = (document as any).caretPositionFromPoint(event.clientX, event.clientY);
            if (pos) {
              range = document.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.collapse(true);
            }
          }

          if (range) {
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);

            const span = document.createElement('span');
            span.className = 'variable-tag';
            span.setAttribute('data-variable', item.value);
            span.setAttribute('data-label', item.label);
            span.setAttribute('contenteditable', 'false');
            span.setAttribute('tabindex', '0');
            span.setAttribute('role', 'button');
            span.setAttribute('aria-label', `Editar rótulo para ${item.value}`);
            span.textContent = formatVariableLabel(item.value, item.label);

            range.insertNode(span);
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection?.removeAllRanges();
            selection?.addRange(range);

            if (draggedNodeRef.current && editorRef.current?.contains(draggedNodeRef.current)) {
              draggedNodeRef.current.remove();
              draggedNodeRef.current = null;
            }

            handleContentUpdate();
            // Focus editor to Ensure toolbar state updates
            focusEditor();
          }

        } catch (error) {
          console.error('Failed to handle variable drop', error);
        }
        return;
      }

      const text = event.dataTransfer?.getData('text/plain');
      if (text) {
        let range: Range | null = null;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(event.clientX, event.clientY);
        }

        if (range) {
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

        document.execCommand('insertText', false, text);
        handleContentUpdate();
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.variable-tag');
      if (target) {
        event.preventDefault();
        setTagEditor({ element: target, label: target.getAttribute('data-label') ?? target.textContent ?? '' });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target && target.classList.contains('variable-tag') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        setTagEditor({ element: target, label: target.getAttribute('data-label') ?? target.textContent ?? '' });
      }
    };

    const handleDragStart = (event: DragEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.variable-tag');
      if (target) {
        const variable = target.getAttribute('data-variable');
        const label = target.getAttribute('data-label');

        if (variable) {
          event.dataTransfer?.setData('text/plain', `{{${variable}}}`);
          event.dataTransfer?.setData('application/x-jus-variable', JSON.stringify({
            value: variable,
            label: label || variable
          }));

          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copyMove';
          }
          draggedNodeRef.current = target;
        }
      }
    };

    const handleDragEnd = () => {
      draggedNodeRef.current = null;
    };

    editor.addEventListener('input', handleInput);
    editor.addEventListener('blur', handleInput);
    editor.addEventListener('drop', handleDrop);
    editor.addEventListener('click', handleClick);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('dragstart', handleDragStart);
    editor.addEventListener('dragend', handleDragEnd);

    return () => {
      editor.removeEventListener('input', handleInput);
      editor.removeEventListener('blur', handleInput);
      editor.removeEventListener('drop', handleDrop);
      editor.removeEventListener('click', handleClick);
      editor.removeEventListener('keydown', handleKeyDown);
      editor.removeEventListener('dragstart', handleDragStart);
      editor.removeEventListener('dragend', handleDragEnd);
    };
  }, [handleContentUpdate, updateToolbarState]);

  useEffect(() => {
    const handleSelectionChange = () => updateToolbarState();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateToolbarState]);

  useEffect(() => {
    if (!tagEditor) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        tagEditor &&
        !tagEditor.element.contains(target) &&
        !target.closest('.variable-tag-editor')
      ) {
        setTagEditor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tagEditor]);

  useEffect(() => {
    if (templateQuery.data && editorRef.current) {
      const data = templateQuery.data as unknown as Template; // Cast as Template to be sure or rely on improved typing

      // Update local state with fetched data
      setTitle(data.title);
      if (data.metadata) {
        setMetadata(data.metadata);
      }

      const html = data.content_editor_json
        ? jsonToHtml(data.content_editor_json)
        : data.content_html;
      editorRef.current.innerHTML = html;
      decorateVariableTags(editorRef.current);
      setContentHtml(html);
      setEditorJson(data.content_editor_json ?? htmlToJson(html));
      setIsDirty(false);
      updateToolbarState();
    } else if (isNew && editorRef.current) {
      editorRef.current.innerHTML = '<p></p>';
      setEditorJson(htmlToJson('<p></p>'));
      decorateVariableTags(editorRef.current);
      updateToolbarState();
    }
  }, [decorateVariableTags, isNew, templateQuery.data, updateToolbarState]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setIsMetadataModalOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const focusEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
  };

  const executeCommand = (command: string, value?: string) => {
    focusEditor();
    document.execCommand(command, false, value);
    handleContentUpdate();
    updateToolbarState();
  };

  const handleAlignmentChange = (value: ToolbarAlignment) => {
    const commands: Record<ToolbarAlignment, string> = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull',
    };
    executeCommand(commands[value]);
  };

  const handleBlockChange = (value: ToolbarBlock) => {
    const blockMap: Record<ToolbarBlock, string> = {
      paragraph: 'P',
      h1: 'H1',
      h2: 'H2',
      h3: 'H3',
    };
    executeCommand('formatBlock', blockMap[value]);
  };

  const handleFontSizeChange = (value: string) => {
    const size = value === 'default' ? '3' : value;
    executeCommand('fontSize', size);
    normalizeFontTags();
    handleContentUpdate();
  };

  const toggleHighlight = () => {
    focusEditor();
    const color = toolbarState.highlight ? 'transparent' : '#fef08a';
    document.execCommand('hiliteColor', false, color);
    handleContentUpdate();
    updateToolbarState();
  };

  const handleInsertImage = () => {
    const src = window.prompt('Informe a URL ou base64 da imagem:');
    if (!src) return;
    executeCommand('insertImage', src);
  };

  const handleInsertTable = () => {
    const rows = 3;
    const cols = 3;
    let html = '<table class="editor-table"><tbody>';
    for (let r = 0; r < rows; r += 1) {
      html += '<tr>';
      for (let c = 0; c < cols; c += 1) {
        html += '<td style="border:1px solid #d4d4d8;padding:8px;min-width:80px">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    executeCommand('insertHTML', html);
  };

  const handleInsertVariable = (item: VariableMenuItem) => {
    if (!item.value) {
      return;
    }

    const selection = document.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor || selection.rangeCount === 0) return;
    focusEditor();
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const span = document.createElement('span');
    span.className = 'variable-tag';
    span.setAttribute('data-variable', item.value);
    span.setAttribute('data-label', item.label);
    span.setAttribute('contenteditable', 'false');
    span.setAttribute('tabindex', '0');
    span.setAttribute('role', 'button');
    span.setAttribute('aria-label', `Editar rótulo para ${item.value}`);
    span.textContent = formatVariableLabel(item.value, item.label);
    range.insertNode(span);
    range.setStartAfter(span);
    range.setEndAfter(span);
    selection.removeAllRanges();
    selection.addRange(range);
    handleContentUpdate();
    updateToolbarState();
    focusSection('editor');
  };

  const handleMetadataConfirm = (values: MetadataFormValues) => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    const json = htmlToJson(html);
    setTitle(values.title);
    const payloadMetadata = {
      type: values.type,
      area: values.area,
      complexity: values.complexity,
      autoCreateClient: values.autoCreateClient,
      autoCreateProcess: values.autoCreateProcess,
      visibility: values.visibility,
    };
    setMetadata(payloadMetadata);
    const payload: TemplatePayload = {
      title: values.title,
      content_html: html,
      content_editor_json: json,
      metadata: payloadMetadata,
    };
    setEditorJson(json);
    saveMutation.mutate(payload);
    setIsMetadataModalOpen(false);
  };

  const focusSection = (section: 'editor' | 'metadata' | 'placeholders') => {
    setActiveSection(section);
    const refMap: Record<typeof section, React.RefObject<HTMLDivElement>> = {
      editor: editorSectionRef,
      metadata: metadataSectionRef,
      placeholders: placeholdersSectionRef,
    };
    refMap[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleGenerateAiContent = async () => {
    const promptText = aiPrompt.trim();
    if (!selectedIntegrationId) {
      toast({
        title: 'Nenhuma integração disponível',
        description: 'Cadastre ou ative uma integração de IA para utilizar este recurso.',
        variant: 'destructive',
      });
      return;
    }

    if (!promptText) {
      toast({
        title: 'Descreva o que precisa',
        description: 'Informe o objetivo do documento para que a IA possa gerar o texto.',
        variant: 'destructive',
      });
      return;
    }

    const documentTypeLabel =
      DOCUMENT_TYPE_OPTIONS.find(option => option.value === aiDocumentType)?.label ?? aiDocumentType;

    setIsGeneratingAiContent(true);

    try {
      const response = await generateAiText({
        integrationId: selectedIntegrationId,
        documentType: documentTypeLabel,
        prompt: promptText,
      });

      const editor = editorRef.current;
      if (editor) {
        editor.innerHTML = response.content;
        handleContentUpdate();
        updateToolbarState();
        focusSection('editor');
        focusEditor();
      }

      toast({
        title: 'Texto gerado com IA',
        description: `Conteúdo criado com ${getApiKeyProviderLabel(response.provider) || response.provider}.`,
      });

      setIsAiModalOpen(false);
      setAiPrompt('');
    } catch (error) {
      console.error('Failed to generate AI text', error);
      toast({
        title: 'Não foi possível gerar o texto',
        description:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao gerar o texto com IA.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAiContent(false);
    }
  };

  const handleUndo = () => {
    focusEditor();
    document.execCommand('undo');
    handleContentUpdate();
    updateToolbarState();
  };

  const handleRedo = () => {
    focusEditor();
    document.execCommand('redo');
    handleContentUpdate();
    updateToolbarState();
  };

  const handleDownload = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        toast({
          title: 'Função disponível apenas no navegador',
          description: 'Abra o editor em um navegador para baixar o documento.',
          variant: 'destructive',
        });
        return;
      }

      const documentTitle = title.trim().length > 0 ? title.trim() : 'Documento';

      // Salvar antes de exportar se houver alterações
      if (isDirty) {
        try {
          // Forçar atualização do estado local antes de salvar
          const editor = editorRef.current;
          if (editor) {
            const html = editor.innerHTML;
            const json = htmlToJson(html);

            // Atualizar estados
            setContentHtml(html);
            setEditorJson(json);

            const payload: TemplatePayload = {
              title,
              content_html: html,
              content_editor_json: json,
              metadata,
            };

            await saveMutation.mutateAsync(payload);
          }
        } catch (error) {
          toast({
            title: 'Erro ao salvar',
            description: 'Não foi possível salvar as alterações antes de exportar.',
            variant: 'destructive',
          });
          return;
        }
      }

      setDownloadState(format);

      try {
        let blob: Blob;

        if (format === 'pdf') {
          const html = contentHtml && contentHtml.length > 0 ? contentHtml : '<p></p>';

          // Usar geração client-side para garantir formatação visual (WYSIWYG)
          blob = await createSimplePdfFromHtml(documentTitle, html, {
            baseUrl: window.location.origin,
          });
        } else {
          // DOCX continua no frontend
          const html = contentHtml && contentHtml.length > 0 ? contentHtml : '<p></p>';
          blob = createDocxBlobFromHtml(html);
        }

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${slugifyFilename(documentTitle)}.${format}`;
        anchor.click();
        URL.revokeObjectURL(url);
        // document.body.removeChild(anchor); // Not strictly needed if we don't append it
      } catch (error) {
        console.error('Failed to download document', error);
        toast({
          title:
            format === 'pdf'
              ? 'Não foi possível gerar o PDF'
              : 'Não foi possível gerar o DOCX',
          description:
            error instanceof Error
              ? error.message
              : 'Tente novamente em instantes.',
          variant: 'destructive',
        });
      } finally {
        setDownloadState(null);
      }
    },
    [contentHtml, title, toast, isDirty, id, isNew, metadata, saveMutation],
  );

  const handleDownloadPdf = useCallback(() => {
    void handleDownload('pdf');
  }, [handleDownload]);

  const handleDownloadDocx = useCallback(() => {
    void handleDownload('docx');
  }, [handleDownload]);

  const clientCustomAttributes: ClientCustomAttributeType[] =
    clientCustomAttributeTypesQuery.data ?? EMPTY_CLIENT_CUSTOM_ATTRIBUTES;
  const isLoadingClientAttributes = clientCustomAttributeTypesQuery.isLoading || clientCustomAttributeTypesQuery.isFetching;
  const hasClientAttributeError = Boolean(clientCustomAttributeTypesQuery.isError);

  const variableMenuItems = useMemo(() => {
    const cloned = cloneVariableMenuItems(variableMenuTree);
    const clientSection = cloned.find(item => item.id === 'cliente');

    if (clientSection) {
      const attributeChildren: VariableMenuItem[] = (() => {
        if (isLoadingClientAttributes) {
          return [
            {
              id: 'cliente.atributos_personalizados.loading',
              label: 'Carregando atributos...',
            },
          ];
        }

        if (hasClientAttributeError) {
          return [
            {
              id: 'cliente.atributos_personalizados.error',
              label: 'Não foi possível carregar os atributos personalizados.',
            },
          ];
        }

        if (clientCustomAttributes.length === 0) {
          return [
            {
              id: 'cliente.atributos_personalizados.empty',
              label: 'Nenhum atributo personalizado cadastrado.',
            },
          ];
        }

        return clientCustomAttributes.map(attribute => ({
          id: `cliente.atributos_personalizados.${attribute.id}`,
          label: attribute.label,
          value: attribute.value,

        }));
      })();

      const baseChildren = clientSection.children ?? [];
      let foundPlaceholder = false;

      const updatedChildren = baseChildren.map(child => {
        if (child.id === 'cliente.atributos_personalizados') {
          foundPlaceholder = true;
          return {
            ...child,
            children: attributeChildren,
          };
        }
        return child;
      });

      if (!foundPlaceholder) {
        updatedChildren.push({
          id: 'cliente.atributos_personalizados',
          label: 'Atributos personalizados',
          children: attributeChildren,
        });
      }

      clientSection.children = updatedChildren;
    }

    return cloned;
  }, [clientCustomAttributes, hasClientAttributeError, isLoadingClientAttributes]);

  const placeholderList = useMemo(() => extractPlaceholders(contentHtml), [contentHtml]);

  const metadataFormDefaults: MetadataFormValues = {
    title,
    type: metadata.type,
    area: metadata.area,
    complexity: metadata.complexity,
    autoCreateClient: metadata.autoCreateClient,
    autoCreateProcess: metadata.autoCreateProcess,
    visibility: metadata.visibility,
  };

  const handleTagEditorSubmit = (label: string) => {
    if (!tagEditor) return;
    const element = tagEditor.element;
    const variable = element.getAttribute('data-variable') ?? '';
    const formatted = formatVariableLabel(variable, label);
    element.setAttribute('data-label', label.trim());
    element.textContent = formatted;
    setTagEditor(null);
    handleContentUpdate();
  };

  const shouldShowSidebar = !isMobile || mobileSidebarOpen;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-muted/10">
      <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/documentos/padroes')}>
            <span className="sr-only">Voltar</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-chevron-left"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Button>
          <div className="flex flex-col">
            <Input
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              className="h-7 border-none bg-transparent px-0 text-lg font-semibold shadow-none hover:bg-muted/50 focus-visible:ring-0 lg:text-xl"
              placeholder="Nome do documento"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveAiIntegrations ? (
            <Button
              variant="default"
              size="sm"
              className="hidden gap-2 bg-indigo-600 text-white hover:bg-indigo-700 sm:flex"
              onClick={() => setIsAiModalOpen(true)}
              disabled={isAiButtonDisabled}
            >
              <Sparkles className="h-4 w-4" />
              {isLoadingAiIntegrations ? 'Carregando IA...' : 'Gerar texto com IA'}
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden gap-2 sm:flex"
                    disabled
                  >
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    IA indisponível
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cadastre uma chave de API (Gemini ou OpenAI) para usar este recurso.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <InsertMenu onSelect={handleInsertVariable} items={variableMenuItems} />

          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 sm:flex"
            onClick={handleDownloadPdf}
            disabled={downloadState === 'pdf'}
          >
            {downloadState === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Baixar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 sm:flex"
            onClick={handleDownloadDocx}
            disabled={downloadState === 'docx'}
          >
            {downloadState === 'docx' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar DOCX
          </Button>

          <SaveButton
            onClick={() => {
              const editor = editorRef.current;
              if (editor) {
                const html = editor.innerHTML;
                const json = htmlToJson(html);
                // Atualizar estados
                setContentHtml(html);
                setEditorJson(json);

                const payload: TemplatePayload = {
                  title,
                  content_html: html,
                  content_editor_json: json,
                  metadata,
                };
                saveMutation.mutate(payload);
              }
            }}
            isDirty={isDirty}
            disabled={saveMutation.isPending}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {shouldShowSidebar && (
          <>
            {/* Desktop Sidebar */}
            <div className="hidden h-full lg:block">
              <SidebarNavigation
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                activeSection={activeSection}
                onSelectSection={focusSection}
                onInsertVariable={handleInsertVariable}
                items={variableMenuItems}
              />
            </div>

            {/* Mobile Sidebar */}
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetContent side="left" className="w-auto p-0">
                <SheetHeader className="border-b p-4 text-left">
                  <SheetTitle>Navegação</SheetTitle>
                </SheetHeader>
                <SidebarNavigation
                  collapsed={false}
                  onToggle={() => setMobileSidebarOpen(false)}
                  activeSection={activeSection}
                  onSelectSection={focusSection}
                  onInsertVariable={handleInsertVariable}
                  items={variableMenuItems}
                />
              </SheetContent>
            </Sheet>
          </>
        )}


        <main className="flex flex-1 flex-col overflow-hidden bg-muted/30">
          <div className="sticky top-0 z-10 border-b bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto max-w-screen-lg">
              <EditorToolbar
                state={toolbarState}
                onBlockChange={handleBlockChange}
                onFontSizeChange={handleFontSizeChange}
                onAlignmentChange={handleAlignmentChange}
                onCommand={(cmd, val) => executeCommand(cmd, val)}
                onHighlight={toggleHighlight}
                onInsertImage={handleInsertImage}
                onInsertTable={handleInsertTable}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto flex max-w-screen-lg flex-col gap-8">
              {/* Editor Section */}
              <div ref={editorSectionRef} className="flex flex-col gap-4">
                <div className="min-h-[29.7cm] w-full bg-white p-4 sm:p-10 md:w-[21cm] md:p-[2.5cm] shadow-sm transition-shadow hover:shadow-md mx-auto">
                  <div
                    ref={editorRef}
                    className="prose prose-sm max-w-none outline-none focus:outline-none"
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Configuration Panels (Metadata, etc) */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Metadata Panel */}
                <div ref={metadataSectionRef} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Metadados</h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsMetadataModalOpen(true)}>
                      Editar
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="grid gap-4 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Tipo</span>
                          <p className="text-sm font-medium">{metadata.type || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Área</span>
                          <p className="text-sm font-medium">{metadata.area || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Complexidade</span>
                          {metadata.complexity ? (
                            <Badge variant={
                              metadata.complexity === 'Alta' ? 'destructive' :
                                metadata.complexity === 'Média' ? 'secondary' : 'outline'
                            }>
                              {metadata.complexity}
                            </Badge>
                          ) : '-'}
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Visibilidade</span>
                          <p className="text-sm font-medium">
                            {metadata.visibility === 'publico' ? 'Público' : 'Privado'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Placeholders Panel */}
                <div ref={placeholdersSectionRef} className="space-y-4">
                  <h3 className="text-lg font-medium tracking-tight">Campos Disponíveis</h3>
                  <Card className="h-[300px] overflow-hidden border-muted bg-muted/10">
                    <ScrollArea className="h-full">
                      <div className="p-4">
                        {variableMenuTree.map(group => (
                          <div key={group.id} className="mb-6 last:mb-0">
                            <h4 className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                              <span className="h-px flex-1 bg-border/50"></span>
                              {group.label}
                              <span className="h-px flex-1 bg-border/50"></span>
                            </h4>
                            <div className="grid gap-1">
                              {group.children?.map(item => (
                                <div key={item.id} className="group flex items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors hover:bg-background hover:shadow-sm">
                                  <span className="font-medium text-muted-foreground group-hover:text-foreground">{item.label}</span>
                                  <code className="rounded bg-muted-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground opacity-70 group-hover:opacity-100">
                                    {item.value ? `{{${item.value}}}` : ''}
                                  </code>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {tagEditor && (
        <div
          className="variable-tag-editor fixed z-50 rounded-md border bg-popover p-2 shadow-md outline-none animate-in fade-in-0 zoom-in-95"
          style={{
            top: tagEditor.element.getBoundingClientRect().bottom + window.scrollY + 8,
            left: tagEditor.element.getBoundingClientRect().left + window.scrollX,
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              value={tagEditor.label}
              onChange={e => {
                const newLabel = e.target.value;
                setTagEditor(prev => (prev ? { ...prev, label: newLabel } : null));
                tagEditor.element.setAttribute('data-label', newLabel);
                tagEditor.element.textContent = formatVariableLabel(
                  tagEditor.element.getAttribute('data-variable') ?? '',
                  newLabel,
                );
                handleContentUpdate();
              }}
              className="h-8 w-48"
              autoFocus
            />
          </div>
        </div>
      )}

      <MetadataModal
        open={isMetadataModalOpen}
        onOpenChange={setIsMetadataModalOpen}
        defaultValues={{
          title,
          type: metadata.type,
          area: metadata.area,
          complexity: metadata.complexity,
          autoCreateClient: metadata.autoCreateClient,
          autoCreateProcess: metadata.autoCreateProcess,
          visibility: metadata.visibility,
        }}
        onConfirm={handleMetadataConfirm}
        isSaving={saveMutation.isPending}
      />

      {/* AI Modal */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Gerar texto com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o documento que você deseja criar e a IA irá gerar um rascunho inicial.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Integração</Label>
                <Select
                  value={selectedIntegrationId?.toString()}
                  onValueChange={val => setSelectedIntegrationId(Number(val))}
                  disabled={activeAiIntegrations.length <= 1}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAiIntegrations.map(integration => (
                      <SelectItem key={integration.id} value={integration.id.toString()}>
                        {getApiKeyProviderLabel(integration.provider)} ({getApiKeyEnvironmentLabel(integration.environment)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={aiDocumentType} onValueChange={setAiDocumentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>O que o documento deve conter?</Label>
              <Textarea
                placeholder="Ex: Crie um contrato de prestação de serviços de marketing digital..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="h-32 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAiModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerateAiContent}
              disabled={isGeneratingAiContent || !aiPrompt.trim()}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {isGeneratingAiContent ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar Rascunho
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
