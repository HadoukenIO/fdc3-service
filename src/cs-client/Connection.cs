using Newtonsoft.Json.Linq;
using OpenFin.FDC3.Constants;
using OpenFin.FDC3.Context;
using OpenFin.FDC3.ContextChannels;
using OpenFin.FDC3.Intents;
using OpenFin.FDC3.Payloads;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Fin = Openfin.Desktop;

namespace OpenFin.FDC3
{
    internal static class Connection
    {
        private static Fin.ChannelClient channelClient;
        private static Action<ContextBase> contextListeners { get; set; }
        private static Action<ChannelChangedEvent> channelChangedHandlers { get; set; }
        private static List<KeyValuePair<string, Action<ContextBase>>> intentListeners { get; set; }

        internal static Action ConnectionInitializationComplete;

        internal static void Initialize(Fin.Runtime runtimeInstance)
        {
            intentListeners = new List<KeyValuePair<string, Action<ContextBase>>>();
            channelClient = runtimeInstance.InterApplicationBus.Channel.CreateClient(Fdc3ServiceConstants.ServiceChannel);

            registerChannelTopics();
            
            channelClient.Connect().ContinueWith(x =>
            {                
                ConnectionInitializationComplete?.Invoke();
            });
        }      

        internal static Task<Channel[]> GetAllChannels()
        {
            return channelClient.Dispatch<Channel[]>(ApiTopic.GetAllChannels, JValue.CreateUndefined());
        }

        internal static Task JoinChannel(string channelId, Fin.WindowIdentity identity)
        {
            return channelClient.Dispatch<Task>(ApiTopic.JoinChannel, identity);
        }

        internal static Task<Fin.WindowIdentity[]> GetChannel(string channelId)
        {
            return channelClient.Dispatch<Fin.WindowIdentity[]>(ApiTopic.GetChannel, channelId);
        }

        internal static Task OpenAsync(string name, ContextBase context = null)
        {
            return channelClient.Dispatch<string>(ApiTopic.Open, new { name, context });
        }

        internal static Task<AppIntent> FindIntent(string intent, ContextBase context)
        {
            return channelClient.Dispatch<AppIntent>(ApiTopic.FindIntent, new { intent, context});            
        }

        internal static Task<AppIntent[]> FindIntentsByContext(ContextBase context)
        {
            return channelClient.Dispatch<AppIntent[]>(ApiTopic.FindIntentsByContext, context);
        }

        internal static void AddChannelChangedEventListener(Action<ChannelChangedEvent> handler)
        {
            channelChangedHandlers += handler;
        }

        internal static void RemoveChannelChangedEventListener(Action<ChannelChangedEvent> handler)
        {
            channelChangedHandlers -= handler;
        }

        internal static Task Broadcast(Context.ContextBase context)
        {
            return channelClient.Dispatch<Task>(ApiTopic.Broadcast, context);
        }

        internal static Task<IntentResolution> RaiseIntent(string intent, ContextBase context, string target)
        {
            return channelClient.Dispatch<IntentResolution>(ApiTopic.RaiseIntent, new { intent, context, target });
        }

        internal static void AddContextListener(Action<ContextBase> handler)
        {
            contextListeners += handler;
        }       

        internal static void UnsubcribeContextListener(Action<ContextBase> handler)
        {
            contextListeners -= handler;
        }

        internal static void AddIntentListener(string intent, Action<ContextBase> handler)
        {            
            intentListeners.Add(new KeyValuePair<string, Action<ContextBase>>(intent, handler));            
        }

        internal static void UnsubscribeIntentListener(string intent)
        {
            intentListeners.RemoveAll(x => x.Key == intent);
        }

        internal static void UnsubscribeIntentListener(string intent, Action<ContextBase> handler)
        {
            intentListeners.RemoveAll(x => x.Key == intent && x.Value == handler);
        }
        private static void registerChannelTopics()
        {
            if (channelClient == null)
            {
                throw new NullReferenceException("ChannelClient must be created before registering topics.");
            }

            channelClient.RegisterTopic<RaiseIntentPayload, object>(ChannelTopicConstants.Intent, payload =>
            {
                var listeners = intentListeners.Where(x => x.Key == payload.Intent).ToList();
                listeners.ForEach(x => x.Value?.Invoke(payload.Context));
                return null;
            });

            channelClient.RegisterTopic<ContextBase, object>(ChannelTopicConstants.Context, payload =>
            {
                contextListeners?.Invoke(payload);
                return null;
            });

            channelClient.RegisterTopic<ChannelChangedEvent, object>(ChannelTopicConstants.Event, @event =>
            {
                channelChangedHandlers?.Invoke(@event);
                return null;
            });
        }
    }
}