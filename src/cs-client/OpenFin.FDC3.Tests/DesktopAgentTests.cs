using System;
using System.Threading.Tasks;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace OpenFin.FDC3.Tests
{
    [TestClass]
    public class DesktopAgentTests
    {
        //[TestMethod]
        //public async Task OpenAsync_OpeningNonExistantApplication_ThrowsException()
        //{
        //    await Assert.ThrowsExceptionAsync<Exception>(async () =>
        //    {
        //        await DesktopAgent.OpenAsync("TestApp");
        //    });
        //}

        [TestMethod]
        public void Initialize_CallingInitializeBeforeSettingCompleteHandler_ThrowsException()
        {            
            Assert.ThrowsException<Exception>(DesktopAgent.Initialize);
        }        
    }
}
